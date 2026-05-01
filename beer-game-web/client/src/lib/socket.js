import { io } from 'socket.io-client';

// 프로덕션: 같은 도메인(서버가 정적 파일 + 소켓 모두 서빙).
// 개발: Vite는 5173, 서버는 3001 — 명시적으로 호스트 IP:3001 사용.
function resolveSocketUrl() {
  if (import.meta.env.VITE_SOCKET_URL) return import.meta.env.VITE_SOCKET_URL;
  if (import.meta.env.PROD) return undefined; // 같은 origin
  // 개발 모드 — localhost 또는 LAN IP의 3001
  return `${window.location.protocol}//${window.location.hostname}:3001`;
}

const SOCKET_URL = resolveSocketUrl();

const baseOpts = {
  autoConnect: true,
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000
};

export function connectAsPlayer(playerToken) {
  return SOCKET_URL
    ? io(SOCKET_URL, { ...baseOpts, auth: { playerToken } })
    : io({ ...baseOpts, auth: { playerToken } });
}

export function connectAsAdmin(sessionId, adminToken) {
  return SOCKET_URL
    ? io(SOCKET_URL, { ...baseOpts, auth: { sessionId, adminToken } })
    : io({ ...baseOpts, auth: { sessionId, adminToken } });
}
