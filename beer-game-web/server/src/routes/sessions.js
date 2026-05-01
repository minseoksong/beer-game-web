import { Router } from 'express';
import { sessions, teams, players } from '../db.js';
import { generateSessionCode, generateAdminToken, generateId } from '../util/code.js';
import { DEFAULT_CONFIG, ROLE_IDS } from '../game/config.js';
import { createInitialTeamState } from '../game/engine.js';
import { startSession, finishSession, forceAdvanceTeam } from '../game/flow.js';
import { summarizeTeam } from '../game/stats.js';

export const sessionsRouter = Router();

function attachOccupants(team, sessionPlayers) {
  const submittedCount = ROLE_IDS.filter(r => team.pendingOrders?.[r] != null).length;
  const totalCost = ROLE_IDS.reduce((s, r) => s + (team.state?.roles?.[r]?.totalCost || 0), 0);
  return {
    id: team.id,
    name: team.name,
    currentWeek: team.currentWeek,
    isFinished: !!team.isFinished,
    submittedCount,
    totalCost,
    occupants: sessionPlayers
      .filter(p => p.teamId === team.id)
      .map(p => ({ role: p.role, name: p.displayName, isAi: !!p.isAi }))
  };
}

// 세션 생성 ---------------------------------------------------------------
sessionsRouter.post('/', (req, res) => {
  const { teamCount = 4, config = {} } = req.body || {};
  const tc = parseInt(teamCount);
  if (!Number.isInteger(tc) || tc < 1 || tc > 20) {
    return res.status(400).json({ error: '팀 개수는 1~20 사이여야 합니다.' });
  }
  const fullConfig = { ...DEFAULT_CONFIG, ...config };

  // 코드 중복 회피
  let code;
  for (let i = 0; i < 5; i++) {
    code = generateSessionCode();
    if (!sessions.findByCode(code)) break;
  }
  if (sessions.findByCode(code)) {
    return res.status(500).json({ error: '코드 생성 충돌 — 다시 시도해주세요.' });
  }

  const id = generateId();
  const adminToken = generateAdminToken();
  const now = Date.now();

  sessions.insert({
    id, code, adminToken,
    teamCount: tc,
    config: fullConfig,
    status: 'lobby',
    createdAt: now,
    finishedAt: null
  });

  for (let i = 1; i <= tc; i++) {
    const teamId = generateId();
    teams.insert({
      id: teamId,
      sessionId: id,
      name: `${i}조`,
      currentWeek: 1,
      state: createInitialTeamState(fullConfig),
      pendingOrders: { retailer: null, wholesaler: null, distributor: null, factory: null },
      history: [],
      isFinished: false,
      lastAdvanceAt: now
    });
  }

  res.status(201).json({
    id, code, adminToken,
    teamCount: tc,
    config: fullConfig,
    status: 'lobby',
    createdAt: now
  });
});

// 결과 비교 (학생/관리자 모두 — 종료된 팀 데이터만 노출) -------------------
// 게임 종료 후 동급 팀들과 비교 학습할 수 있도록 history + summary 공개.
sessionsRouter.get('/code/:code/results', (req, res) => {
  const code = String(req.params.code || '').toUpperCase();
  const session = sessions.findByCode(code);
  if (!session) return res.status(404).json({ error: '세션을 찾을 수 없습니다.' });

  const sessionTeams = teams.listForSession(session.id);
  // 종료된 팀만 노출 (진행 중인 팀의 전략을 다른 팀이 미리 보면 곤란)
  const finishedTeams = sessionTeams.filter(t => t.isFinished);

  res.json({
    sessionCode: session.code,
    sessionStatus: session.status,
    config: session.config,
    teams: finishedTeams.map(t => ({
      id: t.id,
      name: t.name,
      currentWeek: t.currentWeek,
      isFinished: true,
      summary: summarizeTeam(t.state),
      // 차트 오버레이용 핵심 시계열만 (state 전체는 노출 안 함)
      history: (t.history || []).map(h => ({
        week: h.week,
        customerDemand: h.customerDemand,
        roles: ROLE_IDS.reduce((acc, r) => {
          acc[r] = {
            order: h.roles[r].order,
            inventory: h.roles[r].inventory,
            backlog: h.roles[r].backlog,
            totalCost: h.roles[r].totalCost
          };
          return acc;
        }, {})
      }))
    }))
  });
});

// 코드로 조회 (학생용) -----------------------------------------------------
sessionsRouter.get('/code/:code', (req, res) => {
  const code = String(req.params.code || '').toUpperCase();
  const session = sessions.findByCode(code);
  if (!session) return res.status(404).json({ error: '세션을 찾을 수 없습니다.' });

  const teamList = teams.listForSession(session.id);
  const sessionPlayers = players.listForSession(session.id);
  const teamsWithSlots = teamList.map(t => attachOccupants(t, sessionPlayers));

  res.json({
    id: session.id,
    code: session.code,
    teamCount: session.teamCount,
    config: session.config,
    status: session.status,
    teams: teamsWithSlots
  });
});

// 게임 시작 (관리자) -------------------------------------------------------
sessionsRouter.post('/:id/start', (req, res) => {
  const token = req.query.token || req.headers['x-admin-token'];
  const session = sessions.findById(req.params.id);
  if (!session) return res.status(404).json({ error: '세션을 찾을 수 없습니다.' });
  if (token !== session.adminToken) {
    return res.status(403).json({ error: '관리자 인증이 필요합니다.' });
  }
  if (session.status !== 'lobby') {
    return res.status(409).json({ error: `이미 ${session.status} 상태입니다.` });
  }
  const result = startSession(session.id);
  res.json({ status: result.status, aiFilledCount: result.aiFilledCount });
});

// 한 팀 강제 진행 (관리자) — 미제출자를 즉시 AI로 채워 다음 주로 -----------
sessionsRouter.post('/:id/teams/:teamId/force-advance', (req, res) => {
  const token = req.query.token || req.headers['x-admin-token'];
  const session = sessions.findById(req.params.id);
  if (!session) return res.status(404).json({ error: '세션을 찾을 수 없습니다.' });
  if (token !== session.adminToken) {
    return res.status(403).json({ error: '관리자 인증이 필요합니다.' });
  }
  const team = teams.findById(req.params.teamId);
  if (!team || team.sessionId !== session.id) {
    return res.status(404).json({ error: '팀을 찾을 수 없습니다.' });
  }
  if (team.isFinished) return res.status(409).json({ error: '이미 종료된 팀입니다.' });
  forceAdvanceTeam(team.id);
  res.json({ ok: true });
});

// CSV 내보내기 — 모든 팀의 모든 주차 ----------------------------------------
sessionsRouter.get('/:id/export.csv', (req, res) => {
  const token = req.query.token;
  const session = sessions.findById(req.params.id);
  if (!session) return res.status(404).json({ error: '세션을 찾을 수 없습니다.' });
  if (token !== session.adminToken) {
    return res.status(403).json({ error: '관리자 인증이 필요합니다.' });
  }
  const sessionTeams = teams.listForSession(session.id);

  let csv = 'Session,Team,Week,CustomerDemand';
  for (const r of ROLE_IDS) {
    csv += `,${r}_Order,${r}_Inventory,${r}_Backlog,${r}_TotalCost,${r}_Shipped`;
  }
  csv += '\n';

  for (const team of sessionTeams) {
    for (const h of team.history || []) {
      let row = `${session.code},${team.name},${h.week},${h.customerDemand}`;
      for (const r of ROLE_IDS) {
        const d = h.roles[r];
        row += `,${d.order},${d.inventory},${d.backlog},${d.totalCost.toFixed(2)},${d.shipped}`;
      }
      csv += row + '\n';
    }
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="beer_game_${session.code}.csv"`);
  res.send('﻿' + csv); // BOM for Excel UTF-8
});

// 팀 상세 조회 (관리자) ----------------------------------------------------
sessionsRouter.get('/:id/teams/:teamId', (req, res) => {
  const token = req.query.token || req.headers['x-admin-token'];
  const session = sessions.findById(req.params.id);
  if (!session) return res.status(404).json({ error: '세션을 찾을 수 없습니다.' });
  if (token !== session.adminToken) {
    return res.status(403).json({ error: '관리자 인증이 필요합니다.' });
  }
  const team = teams.findById(req.params.teamId);
  if (!team || team.sessionId !== session.id) {
    return res.status(404).json({ error: '팀을 찾을 수 없습니다.' });
  }
  const teamPlayers = players.listForTeam(team.id);
  res.json({
    id: team.id,
    name: team.name,
    currentWeek: team.currentWeek,
    isFinished: !!team.isFinished,
    state: team.state,
    history: team.history || [],
    pendingOrders: team.pendingOrders,
    occupants: teamPlayers.map(p => ({ role: p.role, name: p.displayName, isAi: !!p.isAi })),
    summary: team.history?.length > 0 ? summarizeTeam(team.state) : null,
    sessionConfig: session.config
  });
});

// 게임 강제 종료 (관리자) --------------------------------------------------
sessionsRouter.post('/:id/finish', (req, res) => {
  const token = req.query.token || req.headers['x-admin-token'];
  const session = sessions.findById(req.params.id);
  if (!session) return res.status(404).json({ error: '세션을 찾을 수 없습니다.' });
  if (token !== session.adminToken) {
    return res.status(403).json({ error: '관리자 인증이 필요합니다.' });
  }
  finishSession(session.id);
  res.json({ status: 'finished' });
});

// 관리자 상세 조회 ---------------------------------------------------------
sessionsRouter.get('/:id', (req, res) => {
  const token = req.query.token || req.headers['x-admin-token'];
  const session = sessions.findById(req.params.id);
  if (!session) return res.status(404).json({ error: '세션을 찾을 수 없습니다.' });
  if (token !== session.adminToken) {
    return res.status(403).json({ error: '관리자 인증이 필요합니다.' });
  }

  const teamList = teams.listForSession(session.id);
  const sessionPlayers = players.listForSession(session.id);
  const teamsDetailed = teamList.map(t => attachOccupants(t, sessionPlayers));

  res.json({
    id: session.id,
    code: session.code,
    teamCount: session.teamCount,
    config: session.config,
    status: session.status,
    createdAt: session.createdAt,
    teams: teamsDetailed
  });
});
