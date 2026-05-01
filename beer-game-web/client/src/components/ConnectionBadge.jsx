// 소켓 연결 상태 시각 인디케이터.
// status는 'connected' | 'reconnecting' | 'disconnected' | 'connecting'

export default function ConnectionBadge({ status }) {
  const styles = {
    connected:    { bg: 'bg-green-900/40',  text: 'text-green-300',  dot: 'bg-green-400',  label: '연결됨' },
    connecting:   { bg: 'bg-blue-900/40',   text: 'text-blue-300',   dot: 'bg-blue-400',   label: '연결 중...' },
    reconnecting: { bg: 'bg-yellow-900/40', text: 'text-yellow-300', dot: 'bg-yellow-400 animate-pulse', label: '재연결 중...' },
    disconnected: { bg: 'bg-red-900/40',    text: 'text-red-300',    dot: 'bg-red-400',    label: '연결 끊김' }
  }[status] || { bg: 'bg-gray-900/40', text: 'text-gray-300', dot: 'bg-gray-400', label: status };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs ${styles.bg} ${styles.text}`}>
      <span className={`w-2 h-2 rounded-full ${styles.dot}`} />
      {styles.label}
    </span>
  );
}
