// JSON 파일 기반 DB 어댑터 (기본).
// 외부 의존성 없이 어디서나 동작. 10팀 × 4명 × 50주 규모에서 충분.

import fs from 'node:fs';
import path from 'node:path';
import { log } from '../util/log.js';

export function createJsonStore(dbPath) {
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

  const data = loadOrInit(dbPath);
  let saveTimer = null;

  function persist() {
    if (saveTimer) return;
    saveTimer = setTimeout(() => {
      saveTimer = null;
      const tmp = dbPath + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
      fs.renameSync(tmp, dbPath);
    }, 50);
  }

  return {
    type: 'json',
    sessions: {
      insert(s)               { data.sessions[s.id] = { ...s }; persist(); return data.sessions[s.id]; },
      findById(id)            { return data.sessions[id] || null; },
      findByCode(code)        { return Object.values(data.sessions).find(s => s.code === code) || null; },
      update(id, patch)       {
        if (!data.sessions[id]) return null;
        Object.assign(data.sessions[id], patch); persist();
        return data.sessions[id];
      }
    },
    teams: {
      insert(t)               { data.teams[t.id] = { ...t }; persist(); return data.teams[t.id]; },
      findById(id)            { return data.teams[id] || null; },
      listForSession(sid)     {
        return Object.values(data.teams)
          .filter(t => t.sessionId === sid)
          .sort((a, b) => a.name.localeCompare(b.name, 'ko', { numeric: true }));
      },
      update(id, patch)       {
        if (!data.teams[id]) return null;
        Object.assign(data.teams[id], patch); persist();
        return data.teams[id];
      }
    },
    players: {
      insert(p)               { data.players[p.id] = { ...p }; persist(); return data.players[p.id]; },
      findById(id)            { return data.players[id] || null; },
      findByToken(token)      { return Object.values(data.players).find(p => p.playerToken === token) || null; },
      findByTeamAndRole(tid, role) { return Object.values(data.players).find(p => p.teamId === tid && p.role === role) || null; },
      listForSession(sid)     {
        const teamIds = new Set(Object.values(data.teams).filter(t => t.sessionId === sid).map(t => t.id));
        return Object.values(data.players).filter(p => teamIds.has(p.teamId));
      },
      listForTeam(tid)        { return Object.values(data.players).filter(p => p.teamId === tid); },
      update(id, patch)       {
        if (!data.players[id]) return null;
        Object.assign(data.players[id], patch); persist();
        return data.players[id];
      }
    }
  };
}

function loadOrInit(dbPath) {
  if (fs.existsSync(dbPath)) {
    const raw = fs.readFileSync(dbPath, 'utf8').trim();
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        return {
          sessions: parsed.sessions || {},
          teams:    parsed.teams    || {},
          players:  parsed.players  || {}
        };
      } catch (err) {
        log.warn('손상된 JSON DB — 백업 후 새로 만듭니다', { error: err.message });
        fs.renameSync(dbPath, dbPath + '.broken.' + Date.now());
      }
    }
  }
  return { sessions: {}, teams: {}, players: {} };
}
