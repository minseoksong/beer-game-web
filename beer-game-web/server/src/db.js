// DB 디스패처 — DB_TYPE 환경변수에 따라 JSON 또는 SQLite 어댑터 선택.
// 기본은 JSON (외부 의존성 없음).
//
// SQLite 사용:
//   1. cd server && npm install better-sqlite3
//   2. DB_TYPE=sqlite DB_PATH=/path/to/data.db node src/index.js
//
// 어댑터는 동일한 인터페이스를 노출하므로 라우트/플로우 코드는 변경 불필요.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { log } from './util/log.js';
import { createJsonStore } from './db/json.js';
import { createSqliteStore } from './db/sqlite.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DB_TYPE = (process.env.DB_TYPE || 'json').toLowerCase();
const DB_PATH = process.env.DB_PATH ||
  path.join(__dirname, '..', DB_TYPE === 'sqlite' ? 'data.db' : 'data.json');

const store = DB_TYPE === 'sqlite'
  ? await createSqliteStore(DB_PATH)
  : createJsonStore(DB_PATH);

log.info('DB 준비 완료', { type: store.type, path: DB_PATH });

export const sessions = store.sessions;
export const teams    = store.teams;
export const players  = store.players;
