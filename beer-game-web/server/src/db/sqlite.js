// SQLite 어댑터 — DB_TYPE=sqlite + 'better-sqlite3' 설치된 경우 사용.
// 큰 클래스 규모(50팀 이상)나 영속성 강화가 필요할 때 권장.
//
// 동기 API라 코드가 단순하고, JSON 같은 컬럼은 JSON.stringify/parse로 처리.

import path from 'node:path';
import fs from 'node:fs';
import { log } from '../util/log.js';

export async function createSqliteStore(dbPath) {
  let Database;
  try {
    Database = (await import('better-sqlite3')).default;
  } catch (err) {
    throw new Error(
      'DB_TYPE=sqlite 으로 설정됐지만 better-sqlite3 패키지가 설치되지 않았습니다. ' +
      '설치: cd server && npm install better-sqlite3'
    );
  }

  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // 마이그레이션 — JSON 컬럼은 TEXT로 저장
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      adminToken TEXT NOT NULL,
      teamCount INTEGER NOT NULL,
      config TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'lobby',
      createdAt INTEGER NOT NULL,
      finishedAt INTEGER
    );
    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      sessionId TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      currentWeek INTEGER NOT NULL DEFAULT 1,
      state TEXT NOT NULL DEFAULT '{}',
      pendingOrders TEXT NOT NULL DEFAULT '{}',
      history TEXT NOT NULL DEFAULT '[]',
      isFinished INTEGER NOT NULL DEFAULT 0,
      lastAdvanceAt INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_teams_session ON teams(sessionId);
    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      teamId TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      displayName TEXT NOT NULL,
      playerToken TEXT UNIQUE NOT NULL,
      isAi INTEGER NOT NULL DEFAULT 0,
      joinedAt INTEGER NOT NULL,
      lastSeenAt INTEGER,
      UNIQUE(teamId, role)
    );
    CREATE INDEX IF NOT EXISTS idx_players_team ON players(teamId);
  `);

  log.info('SQLite DB 준비 완료', { path: dbPath });

  // ── 직렬화 헬퍼 ───────────────────────────────────────────
  const JSON_COLS = {
    sessions: ['config'],
    teams:    ['state', 'pendingOrders', 'history'],
    players:  []
  };
  const BOOL_COLS = {
    sessions: [],
    teams:    ['isFinished'],
    players:  ['isAi']
  };
  function rowToObj(table, row) {
    if (!row) return null;
    const obj = { ...row };
    for (const col of JSON_COLS[table]) {
      if (typeof obj[col] === 'string') {
        try { obj[col] = JSON.parse(obj[col]); } catch (_) {}
      }
    }
    for (const col of BOOL_COLS[table]) {
      obj[col] = !!obj[col];
    }
    return obj;
  }
  function objToRow(table, obj) {
    const row = { ...obj };
    for (const col of JSON_COLS[table]) {
      if (row[col] !== undefined && typeof row[col] !== 'string') {
        row[col] = JSON.stringify(row[col]);
      }
    }
    for (const col of BOOL_COLS[table]) {
      if (row[col] !== undefined) row[col] = row[col] ? 1 : 0;
    }
    return row;
  }
  function genericInsert(table, obj, columns) {
    const row = objToRow(table, obj);
    const placeholders = columns.map(c => `@${c}`).join(', ');
    db.prepare(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`)
      .run(columns.reduce((a, c) => { a[c] = row[c] ?? null; return a; }, {}));
    return obj;
  }
  function genericUpdate(table, id, patch) {
    const row = objToRow(table, patch);
    const setCols = Object.keys(row).filter(k => k !== 'id');
    if (setCols.length === 0) return null;
    const sets = setCols.map(c => `${c} = @${c}`).join(', ');
    db.prepare(`UPDATE ${table} SET ${sets} WHERE id = @id`).run({ ...row, id });
    return rowToObj(table, db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id));
  }

  // ── 어댑터 객체 ───────────────────────────────────────────
  return {
    type: 'sqlite',
    sessions: {
      insert(s) {
        return genericInsert('sessions', s, ['id', 'code', 'adminToken', 'teamCount', 'config', 'status', 'createdAt', 'finishedAt']);
      },
      findById(id) {
        return rowToObj('sessions', db.prepare('SELECT * FROM sessions WHERE id = ?').get(id));
      },
      findByCode(code) {
        return rowToObj('sessions', db.prepare('SELECT * FROM sessions WHERE code = ?').get(code));
      },
      update(id, patch) { return genericUpdate('sessions', id, patch); }
    },
    teams: {
      insert(t) {
        return genericInsert('teams', t, ['id', 'sessionId', 'name', 'currentWeek', 'state', 'pendingOrders', 'history', 'isFinished', 'lastAdvanceAt']);
      },
      findById(id) {
        return rowToObj('teams', db.prepare('SELECT * FROM teams WHERE id = ?').get(id));
      },
      listForSession(sid) {
        return db.prepare('SELECT * FROM teams WHERE sessionId = ?').all(sid)
          .map(r => rowToObj('teams', r))
          .sort((a, b) => a.name.localeCompare(b.name, 'ko', { numeric: true }));
      },
      update(id, patch) { return genericUpdate('teams', id, patch); }
    },
    players: {
      insert(p) {
        return genericInsert('players', p, ['id', 'teamId', 'role', 'displayName', 'playerToken', 'isAi', 'joinedAt', 'lastSeenAt']);
      },
      findById(id) {
        return rowToObj('players', db.prepare('SELECT * FROM players WHERE id = ?').get(id));
      },
      findByToken(token) {
        return rowToObj('players', db.prepare('SELECT * FROM players WHERE playerToken = ?').get(token));
      },
      findByTeamAndRole(tid, role) {
        return rowToObj('players', db.prepare('SELECT * FROM players WHERE teamId = ? AND role = ?').get(tid, role));
      },
      listForSession(sid) {
        return db.prepare(`
          SELECT p.* FROM players p JOIN teams t ON p.teamId = t.id WHERE t.sessionId = ?
        `).all(sid).map(r => rowToObj('players', r));
      },
      listForTeam(tid) {
        return db.prepare('SELECT * FROM players WHERE teamId = ?').all(tid).map(r => rowToObj('players', r));
      },
      update(id, patch) { return genericUpdate('players', id, patch); }
    }
  };
}
