// 게임 진행 흐름 — 세션 시작, 주문 제출 → 자동 진행, 자동 AI 대체 타이머.
// Socket.io 이벤트 송출은 emitter를 통해 외부 주입 (서버/소켓 모듈과 분리).

import { sessions, teams, players } from '../db.js';
import { generateId, generatePlayerToken } from '../util/code.js';
import { ROLE_IDS } from './config.js';
import { simulateWeek, isFinished } from './engine.js';
import { aiDecide } from './ai.js';
import { summarizeTeam } from './stats.js';

// 이벤트 송출 — index.js가 부팅 시 setEmitter로 io 인스턴스를 주입
let emitter = {
  toTeam: (_teamId, _event, _payload) => {},
  toAdmin: (_sessionId, _event, _payload) => {}
};
export function setEmitter(e) { emitter = e; }

// 자동 AI 대체까지 기다리는 시간 (ms)
const AUTO_ADVANCE_TIMEOUT_MS = 30_000;

// 활성 타이머 (teamId -> Timeout)
const teamTimers = new Map();

function clearTeamTimer(teamId) {
  if (teamTimers.has(teamId)) {
    clearTimeout(teamTimers.get(teamId));
    teamTimers.delete(teamId);
  }
}

function scheduleAutoAdvance(teamId) {
  clearTeamTimer(teamId);
  const timer = setTimeout(() => {
    teamTimers.delete(teamId);
    forceAdvanceTeam(teamId);
  }, AUTO_ADVANCE_TIMEOUT_MS);
  teamTimers.set(teamId, timer);
}

// 세션 시작: 빈 자리에 AI 플레이어 생성, 상태 running으로 -----------------
export function startSession(sessionId) {
  const session = sessions.findById(sessionId);
  if (!session) throw new Error('세션 없음');

  const sessionTeams = teams.listForSession(sessionId);
  let aiFilledCount = 0;
  const now = Date.now();

  for (const team of sessionTeams) {
    const teamPlayers = players.listForTeam(team.id);
    for (const role of ROLE_IDS) {
      const occ = teamPlayers.find(p => p.role === role);
      if (!occ) {
        players.insert({
          id: generateId(),
          teamId: team.id,
          role,
          displayName: 'AI',
          playerToken: generatePlayerToken(),
          isAi: true,
          joinedAt: now,
          lastSeenAt: now
        });
        aiFilledCount++;
      }
    }
    // 게임 시작 직후, AI 자리에 대해 즉시 주문 결정 시도 (사람만 기다리면 됨)
    autoSubmitAi(team.id);
    scheduleAutoAdvance(team.id);
  }

  sessions.update(sessionId, { status: 'running' });
  emitter.toAdmin(sessionId, 'session:started', { sessionId });
  for (const team of sessionTeams) {
    emitter.toTeam(team.id, 'game:started', { teamId: team.id });
  }
  return { status: 'running', aiFilledCount };
}

// 세션 종료 (관리자가 누르거나 모든 팀 완료 시) -------------------------
export function finishSession(sessionId) {
  const sessionTeams = teams.listForSession(sessionId);
  for (const team of sessionTeams) {
    clearTeamTimer(team.id);
    if (!team.isFinished) {
      teams.update(team.id, { isFinished: true });
      emitter.toTeam(team.id, 'game:finished', summarizeForBroadcast(team.id));
    }
  }
  sessions.update(sessionId, { status: 'finished', finishedAt: Date.now() });
  emitter.toAdmin(sessionId, 'session:finished', { sessionId });
}

// 한 역할의 주문 제출 -----------------------------------------------------
export function submitOrder(teamId, role, qty) {
  const team = teams.findById(teamId);
  if (!team) throw new Error('팀 없음');
  if (team.isFinished) throw new Error('이미 종료');
  if (!ROLE_IDS.includes(role)) throw new Error('잘못된 역할');
  const v = parseInt(qty);
  if (!Number.isFinite(v) || v < 0) throw new Error('잘못된 주문량');

  const session = sessions.findById(team.sessionId);
  if (!session) throw new Error('세션 없음');
  if (session.status !== 'running') throw new Error('게임이 진행 중이 아닙니다');

  team.pendingOrders[role] = v;
  teams.update(teamId, { pendingOrders: team.pendingOrders });

  // 모든 역할 제출됐으면 즉시 진행
  const allSubmitted = ROLE_IDS.every(r => team.pendingOrders[r] != null);
  if (allSubmitted) {
    advanceTeam(teamId);
  } else {
    emitter.toTeam(teamId, 'order:submitted', {
      role,
      pendingOrders: team.pendingOrders
    });
  }
}

// AI 자리는 즉시 자동 결정 ------------------------------------------------
function autoSubmitAi(teamId) {
  const team = teams.findById(teamId);
  if (!team || team.isFinished) return;
  const teamPlayers = players.listForTeam(team.id);
  const session = sessions.findById(team.sessionId);
  if (!session) return;
  const config = session.config;

  for (const role of ROLE_IDS) {
    if (team.pendingOrders[role] != null) continue;
    const occ = teamPlayers.find(p => p.role === role);
    if (occ?.isAi) {
      team.pendingOrders[role] = aiDecide(team.state, role, config);
    }
  }
  teams.update(teamId, { pendingOrders: team.pendingOrders });

  if (ROLE_IDS.every(r => team.pendingOrders[r] != null)) {
    advanceTeam(teamId);
  }
}

// 30초 타임아웃 — 미제출자를 AI로 대체해 강제 진행 -----------------------
export function forceAdvanceTeam(teamId) {
  const team = teams.findById(teamId);
  if (!team || team.isFinished) return;
  const session = sessions.findById(team.sessionId);
  if (!session || session.status !== 'running') return;
  const config = session.config;

  let filled = 0;
  for (const role of ROLE_IDS) {
    if (team.pendingOrders[role] == null) {
      team.pendingOrders[role] = aiDecide(team.state, role, config);
      filled++;
    }
  }
  if (filled > 0) {
    emitter.toTeam(teamId, 'order:auto_filled', { count: filled });
  }
  teams.update(teamId, { pendingOrders: team.pendingOrders });
  advanceTeam(teamId);
}

// 한 주 진행 -------------------------------------------------------------
function advanceTeam(teamId) {
  const team = teams.findById(teamId);
  if (!team || team.isFinished) return;
  const session = sessions.findById(team.sessionId);
  const config = session.config;

  clearTeamTimer(teamId);

  const orders = { ...team.pendingOrders };
  // 시뮬레이션
  const snapshot = simulateWeek(team.state, orders, config);
  team.history.push(snapshot);
  team.currentWeek = team.state.week;
  // 다음 주 대기 주문 초기화
  team.pendingOrders = { retailer: null, wholesaler: null, distributor: null, factory: null };

  teams.update(teamId, {
    state: team.state,
    history: team.history,
    currentWeek: team.currentWeek,
    pendingOrders: team.pendingOrders,
    lastAdvanceAt: Date.now()
  });

  emitter.toTeam(teamId, 'week:advanced', {
    week: snapshot.week,
    snapshot,
    teamState: serializeTeamState(team)
  });
  emitter.toAdmin(session.id, 'team:event', {
    teamId,
    week: team.currentWeek,
    totalCost: ROLE_IDS.reduce((s, r) => s + team.state.roles[r].totalCost, 0)
  });

  // 게임 종료 체크
  if (isFinished(team.state, config)) {
    teams.update(teamId, { isFinished: true });
    emitter.toTeam(teamId, 'game:finished', summarizeForBroadcast(teamId));
    emitter.toAdmin(session.id, 'team:event', { teamId, finished: true });
    // 모든 팀 종료됐으면 세션도 종료
    const allTeams = teams.listForSession(session.id);
    if (allTeams.every(t => t.isFinished)) {
      sessions.update(session.id, { status: 'finished', finishedAt: Date.now() });
      emitter.toAdmin(session.id, 'session:finished', { sessionId: session.id });
    }
    return;
  }

  // 다음 주 — AI 자리 즉시 채움 + 30초 타이머
  autoSubmitAi(teamId);
  // autoSubmitAi가 advanceTeam을 또 호출했을 수 있으니 (모두 AI인 경우) 다시 체크
  const refreshed = teams.findById(teamId);
  if (refreshed && !refreshed.isFinished) {
    scheduleAutoAdvance(teamId);
  }
}

// 직렬화 (소켓으로 보내기 좋게 — pendingOrders는 본인 외엔 마스킹) -------
export function serializeTeamState(team) {
  return {
    teamId: team.id,
    name: team.name,
    currentWeek: team.currentWeek,
    isFinished: !!team.isFinished,
    state: team.state,
    history: team.history,
    submitted: ROLE_IDS.reduce((acc, r) => {
      acc[r] = team.pendingOrders[r] != null;
      return acc;
    }, {})
  };
}

function summarizeForBroadcast(teamId) {
  const team = teams.findById(teamId);
  if (!team) return null;
  return {
    teamId,
    name: team.name,
    summary: summarizeTeam(team.state),
    history: team.history
  };
}

// 모든 활성 타이머 정리 (서버 종료 시)
export function shutdown() {
  for (const t of teamTimers.values()) clearTimeout(t);
  teamTimers.clear();
}
