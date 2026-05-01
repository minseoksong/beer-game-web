import { Router } from 'express';
import { sessions, teams, players } from '../db.js';
import { generatePlayerToken, generateId } from '../util/code.js';

export const teamsRouter = Router();

const VALID_ROLES = new Set(['retailer', 'wholesaler', 'distributor', 'factory']);

// 팀 + 역할로 합류 ---------------------------------------------------------
teamsRouter.post('/:teamId/join', (req, res) => {
  const { role, name } = req.body || {};
  if (!VALID_ROLES.has(role)) {
    return res.status(400).json({ error: '역할 값이 올바르지 않습니다.' });
  }
  const trimmed = String(name || '').trim();
  if (!trimmed || trimmed.length > 30) {
    return res.status(400).json({ error: '이름은 1~30자여야 합니다.' });
  }

  const team = teams.findById(req.params.teamId);
  if (!team) return res.status(404).json({ error: '팀을 찾을 수 없습니다.' });

  const session = sessions.findById(team.sessionId);
  if (!session) return res.status(404).json({ error: '세션을 찾을 수 없습니다.' });
  if (session.status === 'finished') {
    return res.status(409).json({ error: '이미 종료된 세션입니다.' });
  }

  const existing = players.findByTeamAndRole(team.id, role);
  if (existing && !existing.isAi) {
    return res.status(409).json({ error: '이미 다른 사람이 그 역할을 맡고 있습니다.' });
  }

  const now = Date.now();
  const playerId = generateId();
  const token = generatePlayerToken();
  players.insert({
    id: playerId,
    teamId: team.id,
    role,
    displayName: trimmed,
    playerToken: token,
    isAi: false,
    joinedAt: now,
    lastSeenAt: now
  });

  res.status(201).json({
    playerId,
    playerToken: token,
    teamId: team.id,
    teamName: team.name,
    role,
    sessionId: session.id,
    sessionCode: session.code
  });
});

// 토큰으로 자기 정보 가져오기 (재접속) -------------------------------------
teamsRouter.get('/me', (req, res) => {
  const token = req.headers['x-player-token'] || req.query.token;
  if (!token) return res.status(401).json({ error: '토큰이 필요합니다.' });
  const me = players.findByToken(token);
  if (!me) return res.status(401).json({ error: '유효하지 않은 토큰입니다.' });

  const team = teams.findById(me.teamId);
  const session = team ? sessions.findById(team.sessionId) : null;

  // last_seen 갱신
  players.update(me.id, { lastSeenAt: Date.now() });

  res.json({
    playerId: me.id,
    teamId: me.teamId,
    role: me.role,
    name: me.displayName,
    sessionId: session?.id,
    sessionCode: session?.code
  });
});
