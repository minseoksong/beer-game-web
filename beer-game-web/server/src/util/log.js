// 단순 구조화 로거 — 외부 의존성 없이 JSON 라인 출력.
// 운영 환경에서 stdout을 그대로 파일/수집기로 보낼 수 있음.

const LEVELS = { trace: 10, debug: 20, info: 30, warn: 40, error: 50 };
const MIN_LEVEL = LEVELS[(process.env.LOG_LEVEL || 'info').toLowerCase()] || LEVELS.info;
const PRETTY = process.env.NODE_ENV !== 'production';

function emit(level, msg, fields) {
  if (LEVELS[level] < MIN_LEVEL) return;
  const ts = new Date().toISOString();
  if (PRETTY) {
    const tag = level.toUpperCase().padEnd(5);
    const f = fields && Object.keys(fields).length
      ? ' ' + Object.entries(fields).map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' ')
      : '';
    console.log(`[${ts}] ${tag} ${msg}${f}`);
  } else {
    console.log(JSON.stringify({ ts, level, msg, ...(fields || {}) }));
  }
}

export const log = {
  trace: (msg, fields) => emit('trace', msg, fields),
  debug: (msg, fields) => emit('debug', msg, fields),
  info:  (msg, fields) => emit('info',  msg, fields),
  warn:  (msg, fields) => emit('warn',  msg, fields),
  error: (msg, fields) => emit('error', msg, fields)
};
