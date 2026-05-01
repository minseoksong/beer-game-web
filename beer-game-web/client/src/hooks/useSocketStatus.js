import { useEffect, useState } from 'react';

// 소켓 인스턴스를 받아 연결 상태(connected/disconnected/reconnecting)를 추적.
// Play/Lobby/Results 등에서 같은 패턴으로 사용.
export function useSocketStatus(socket) {
  const [status, setStatus] = useState('connecting');

  useEffect(() => {
    if (!socket) return;
    const onConnect = () => setStatus('connected');
    const onDisconnect = (reason) => {
      // 명시적 disconnect (서버 reset) vs 네트워크 끊김
      setStatus(reason === 'io client disconnect' ? 'disconnected' : 'reconnecting');
    };
    const onConnectError = () => setStatus('reconnecting');
    const onReconnect = () => setStatus('connected');
    const onReconnectFailed = () => setStatus('disconnected');

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.io.on('reconnect', onReconnect);
    socket.io.on('reconnect_failed', onReconnectFailed);

    if (socket.connected) setStatus('connected');

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.io.off('reconnect', onReconnect);
      socket.io.off('reconnect_failed', onReconnectFailed);
    };
  }, [socket]);

  return status;
}
