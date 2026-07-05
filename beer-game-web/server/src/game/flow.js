// 게임 진행 흐름 — 세션 시작, 주문 제출 → 자동 진행, 자동 AI 대체 타이머.
// Socket.io 이벤트 송출은 emitter를 통해 외부 주입 (서버/소켓 모듈과 분리).

import { sessions, teams, players } from '../db.js';
import { generateId, generatePlayerToken } from '../util/code.js';
import { ROLE_IDS, downstreamOf, upstreamOf } from './config.js';
import { simulateWeek, isFinished } from './engine.js';
import { aiDecide } from './ai.js';
import { summarizeTeam } from './stats.js';

// 이벤트 송출 — index.js가 부팅 시 setEmitter로 io 인스턴스를 주입
let emitter = {
  toTeam: (_teamId, _event, _payload) => {},
  toTeamRole: (_teamId, _role, _event, _payload) => {},
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
    // 다른 사람의 실제 주문값은 노출하지 않음 — 제출 여부(boolean)만 전송
    emitter.toTeam(teamId, 'order:submitted', {
      role,
      submitted: ROLE_IDS.reduce((acc, r) => {
        acc[r] = team.pendingOrders[r] != null;
        return acc;
      }, {})
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

  // 역할별로 마스킹된 스냅샷/상태를 각 역할 룸에 개별 전송
  for (const role of ROLE_IDS) {
    const visible = visibleRolesFor(role, config.info || 'partial');
    emitter.toTeamRole(teamId, role, 'week:advanced', {
      week: snapshot.week,
      snapshot: maskSnapshot(snapshot, visible),
      teamState: serializeTeamState(team, role)
    });
  }
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

// 정보 격리 — 뷰어(viewerRole)가 볼 수 있는 역할 집합.
// 클라이언트 ChartsSection의 visibleRoles 로직과 일치해야 함.
//   partial: 자기 단계만 / full: 인접 단계 / open: 전체
export function visibleRolesFor(viewerRole, info) {
  if (info === 'open') return [...ROLE_IDS];
  if (info === 'full') {
    return [viewerRole, downstreamOf(viewerRole), upstreamOf(viewerRole)].filter(Boolean);
  }
  return [viewerRole]; // partial (기본)
}

function pickRoles(rolesObj, visible) {
  return visible.reduce((acc, r) => {
    if (rolesObj[r] != null) acc[r] = rolesObj[r];
    return acc;
  }, {});
}

// 고객 수요는 소매상만 관측 가능 — 소매상이 visible에 포함될 때만 노출
function maskState(state, visible) {
  return {
    week: state.week,
    customerDemandHistory: visible.includes('retailer') ? state.customerDemandHistory : [],
    roles: pickRoles(state.roles, visible)
  };
}

function maskHistory(history, visible) {
  return history.map(h => ({
    week: h.week,
    customerDemand: visible.includes('retailer') ? h.customerDemand : null,
    roles: pickRoles(h.roles, visible)
  }));
}

export function maskSnapshot(snapshot, visible) {
  return {
    week: snapshot.week,
    customerDemand: visible.includes('retailer') ? snapshot.customerDemand : null,
    roles: pickRoles(snapshot.roles, visible)
  };
}

// 직렬화 (소켓으로 보내기 좋게). viewerRole이 주어지고 게임이 진행 중이면
// 세션의 info 모드에 맞춰 다른 역할의 state/history를 서버에서 마스킹한다.
// 게임 종료 후(isFinished) 또는 viewerRole이 없으면(관리자 등) 전체 공개.
export function serializeTeamState(team, viewerRole = null) {
  const finished = !!team.isFinished;
  let visible = [...ROLE_IDS];
  if (!finished && viewerRole) {
    const session = sessions.findById(team.sessionId);
    const info = session?.config?.info || 'partial';
    visible = visibleRolesFor(viewerRole, info);
  }
  const maskingOn = !finished && viewerRole;
  return {
    teamId: team.id,
    name: team.name,
    currentWeek: team.currentWeek,
    isFinished: finished,
    // 팀 누적 비용은 팀 공동 점수이므로 항상 합계만 제공 (역할별 내역은 마스킹 대상)
    teamTotalCost: ROLE_IDS.reduce((s, r) => s + team.state.roles[r].totalCost, 0),
    state: maskingOn ? maskState(team.state, visible) : team.state,
    history: maskingOn ? maskHistory(team.history, visible) : team.history,
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
