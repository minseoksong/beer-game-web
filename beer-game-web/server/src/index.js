import express from 'express';
import cors from 'cors';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import './db.js'; // 마이그레이션 실행
import { sessionsRouter } from './routes/sessions.js';
import { teamsRouter } from './routes/teams.js';
import { attachSockets } from './sockets/index.js';
import { shutdown } from './game/flow.js';
import { log } from './util/log.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = parseInt(process.env.PORT) || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';
const PUBLIC_DIR = process.env.PUBLIC_DIR || path.join(__dirname, '..', 'public');

const app = express();

app.use(cors());
app.use(express.json());

// 헬스체크
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, env: NODE_ENV, t: Date.now() });
});

// API 라우트
app.use('/api/sessions', sessionsRouter);
app.use('/api/teams', teamsRouter);

// 프로덕션 모드: 빌드된 클라이언트 정적 파일 서빙 + SPA 폴백 -------------
// PUBLIC_DIR(기본값 server/public)에 client 빌드 산출물을 배치.
const hasPublic = fs.existsSync(path.join(PUBLIC_DIR, 'index.html'));
if (NODE_ENV === 'production' || hasPublic) {
  if (hasPublic) {
    log.info('정적 파일 서빙', { dir: PUBLIC_DIR });
    app.use(express.static(PUBLIC_DIR, { maxAge: '1h', index: false }));
    // SPA 폴백: /api와 /socket.io 외 모든 GET은 index.html
    app.get(/^(?!\/api\/|\/socket\.io\/).*/, (_req, res) => {
      res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
    });
  } else {
    log.warn('NODE_ENV=production이지만 PUBLIC_DIR 비어있음', { dir: PUBLIC_DIR });
  }
}

// 에러 핸들러
app.use((err, _req, res, _next) => {
  log.error('서버 에러', { message: err.message, stack: err.stack });
  res.status(500).json({ error: '서버 오류', detail: err.message });
});

// HTTP + Socket.io
const httpServer = http.createServer(app);
attachSockets(httpServer);

httpServer.listen(PORT, () => {
  log.info('서버 시작', {
    port: PORT,
    env: NODE_ENV,
    url: `http://localhost:${PORT}`,
    public: hasPublic ? PUBLIC_DIR : '(개발 모드 — 클라이언트는 별도 실행)'
  });
});

// 우아한 종료
function gracefulShutdown(signal) {
  log.info('종료 시그널 수신', { signal });
  shutdown();
  httpServer.close(() => {
    log.info('서버 종료 완료');
    process.exit(0);
  });
  // 5초 안에 안 닫히면 강제 종료
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
