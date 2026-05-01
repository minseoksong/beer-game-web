import { Server } from 'socket.io';
import { sessions, teams, players } from '../db.js';
import { setEmitter, submitOrder, serializeTeamState } from '../game/flow.js';
import { ROLE_IDS } from '../game/config.js';

// 인증 결과 — 한 소켓에 부착
//   소켓.data.kind = 'player' | 'admin'
//   소켓.data.player / .session 등

export function attachSockets(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: '*' }
  });

  // 인증 미들웨어
  io.use((socket, next) => {
    const auth = socket.handshake.auth || {};
    if (auth.playerToken) {
      const me = players.findByToken(auth.playerToken);
      if (!me) return next(new Error('유효하지 않은 플레이어 토큰'));
      const team = teams.findById(me.teamId);
      const session = team ? sessions.findById(team.sessionId) : null;
      if (!team || !session) return next(new Error('팀/세션을 찾을 수 없음'));
      socket.data = { kind: 'player', player: me, team, session };
      players.update(me.id, { lastSeenAt: Date.now() });
      return next();
    }
    if (auth.adminToken && auth.sessionId) {
      const session = sessions.findById(auth.sessionId);
      if (!session) return next(new Error('세션 없음'));
      if (auth.adminToken !== session.adminToken) {
        return next(new Error('관리자 인증 실패'));
      }
      socket.data = { kind: 'admin', session };
      return next();
    }
    next(new Error('인증 정보 없음'));
  });

  io.on('connection', (socket) => {
    if (socket.data.kind === 'player') {
      handlePlayer(io, socket);
    } else if (socket.data.kind === 'admin') {
      handleAdmin(io, socket);
    }
  });

  // flow.js에 emit 함수 주입
  setEmitter({
    toTeam: (teamId, event, payload) => io.to(`team:${teamId}`).emit(event, payload),
    toAdmin: (sessionId, event, payload) => io.to(`admin:${sessionId}`).emit(event, payload)
  });

  return io;
}

// ------------------------------------------------------- player handlers
function handlePlayer(_io, socket) {
  const { team, session, player } = socket.data;

  socket.join(`team:${team.id}`);

  // 초기 상태 푸시
  socket.emit('state:full', {
    me: { role: player.role, name: player.displayName, isAi: !!player.isAi },
    session: { id: session.id, code: session.code, status: session.status, config: session.config },
    team: serializeTeamState(team),
    teammates: getTeammates(team.id)
  });

  socket.on('order:submit', (payload, ack) => {
    try {
      const qty = parseInt(payload?.qty);
      submitOrder(team.id, player.role, qty);
      ack?.({ ok: true });
    } catch (err) {
      ack?.({ ok: false, error: err.message });
    }
  });

  socket.on('disconnect', () => {
    players.update(player.id, { lastSeenAt: Date.now() });
  });
}

function getTeammates(teamId) {
  return players.listForTeam(teamId).map(p => ({
    role: p.role,
    name: p.displayName,
    isAi: !!p.isAi
  }));
}

// ------------------------------------------------------- admin handlers
function handleAdmin(_io, socket) {
  const { session } = socket.data;
  socket.join(`admin:${session.id}`);

  // 초기 스냅샷
  const sessionTeams = teams.listForSession(session.id);
  socket.emit('admin:full', {
    session: { id: session.id, code: session.code, status: session.status, config: session.config },
    teams: sessionTeams.map(t => ({
      id: t.id,
      name: t.name,
      currentWeek: t.currentWeek,
      isFinished: !!t.isFinished,
      occupants: players.listForTeam(t.id).map(p => ({
        role: p.role, name: p.displayName, isAi: !!p.isAi
      })),
      submitted: ROLE_IDS.reduce((acc, r) => {
        acc[r] = t.pendingOrders?.[r] != null;
        return acc;
      }, {}),
      totalCost: ROLE_IDS.reduce((s, r) => s + (t.state?.roles?.[r]?.totalCost || 0), 0)
    }))
  });
}
