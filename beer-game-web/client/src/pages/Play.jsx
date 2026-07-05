import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  Title, Tooltip, Legend
} from 'chart.js';
import { connectAsPlayer } from '../lib/socket.js';
import { useSocketStatus } from '../hooks/useSocketStatus.js';
import ConnectionBadge from '../components/ConnectionBadge.jsx';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const ROLE_LABELS = {
  retailer: '소매상', wholesaler: '도매상', distributor: '유통업자', factory: '공장'
};
const ROLE_COLORS = {
  retailer: '#e76f51', wholesaler: '#f4a261', distributor: '#e9c46a', factory: '#2a9d8f'
};
const ROLE_ORDER = ['retailer', 'wholesaler', 'distributor', 'factory'];

export default function Play() {
  const navigate = useNavigate();
  const [me, setMe] = useState(null);
  const [session, setSession] = useState(null);
  const [team, setTeam] = useState(null);
  const [teammates, setTeammates] = useState([]);
  const [orderInput, setOrderInput] = useState('');
  const [statusMsg, setStatusMsg] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [socket, setSocket] = useState(null);
  const socketRef = useRef(null);
  const connStatus = useSocketStatus(socket);

  useEffect(() => {
    const token = localStorage.getItem('player_token');
    if (!token) { navigate('/join'); return; }

    const s = connectAsPlayer(token);
    socketRef.current = s;
    setSocket(s);

    s.on('connect_error', (err) => setStatusMsg({ type: 'error', text: '연결 실패: ' + err.message }));

    s.on('state:full', (data) => {
      setMe(data.me);
      setSession(data.session);
      setTeam(data.team);
      setTeammates(data.teammates);
      if (data.team.isFinished || data.session.status === 'finished') {
        navigate('/results');
      } else if (data.session.status === 'lobby') {
        navigate('/lobby');
      }
    });

    s.on('week:advanced', (data) => {
      setTeam(data.teamState);
      setOrderInput('');
      setSubmitting(false);
      setStatusMsg({ type: 'info', text: `주 ${data.snapshot.week} 완료. 다음 주 주문을 입력하세요.` });
    });

    s.on('order:submitted', (data) => {
      setTeam(t => t ? { ...t, submitted: data.submitted || t.submitted } : t);
    });

    s.on('order:auto_filled', (data) => {
      setStatusMsg({ type: 'warn', text: `${data.count}개 자리가 시간 초과로 AI 자동 결정됐습니다.` });
    });

    s.on('game:finished', () => navigate('/results'));

    return () => s.disconnect();
  }, [navigate]);

  function submitOrder(e) {
    e.preventDefault();
    const qty = parseInt(orderInput);
    if (!Number.isFinite(qty) || qty < 0) {
      setStatusMsg({ type: 'error', text: '0 이상의 정수를 입력하세요.' });
      return;
    }
    setSubmitting(true);
    socketRef.current.emit('order:submit', { qty }, (ack) => {
      if (ack?.ok) {
        setStatusMsg({ type: 'info', text: `주문 ${qty} 제출됨. 다른 멤버 대기 중...` });
      } else {
        setStatusMsg({ type: 'error', text: ack?.error || '제출 실패' });
        setSubmitting(false);
      }
    });
  }

  if (!me || !session || !team) {
    return <div className="text-[#8a96a8]">연결 중...</div>;
  }

  const config = session.config;
  const myRole = me.role;
  const myState = team.state.roles[myRole];
  const downstreamRole = downstreamOf(myRole);
  const upstreamRole = upstreamOf(myRole);
  const customerDemand = team.state.customerDemandHistory.length > 0
    ? team.state.customerDemandHistory[team.state.customerDemandHistory.length - 1]
    : null;
  const incomingShipment = myState.incomingShipments[0] || 0;
  // 이번 주 들어올 주문 — 소매상은 고객 수요(다음 주 시뮬레이션 시), 그 외는 큐 첫 항목
  // 단, 시뮬레이션 시점에 결정되므로 표시는 "지난 주 받은" 값으로 하는 게 정확.
  // 여기선 직전 주문 표시.
  const lastIncomingOrder = myRole === 'retailer'
    ? (customerDemand ?? '—')
    : (myState.incomingOrders[0] || 0);
  const lastOrder = myState.orderHistory.length > 0
    ? myState.orderHistory[myState.orderHistory.length - 1]
    : '—';
  const myPending = team.submitted?.[myRole];
  // 팀 누적 비용은 서버가 합계로 제공 (역할별 내역은 정보 격리로 마스킹됨)
  const totalCost = team.teamTotalCost
    ?? ROLE_ORDER.reduce((s, r) => s + (team.state.roles[r]?.totalCost || 0), 0);

  return (
    <div className="space-y-4">
      {/* 상단 헤더 */}
      <div className="bg-[#1a2332] border border-[#2c3a52] rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm text-[#8a96a8]">{team.name}</div>
            <div className="text-xl font-bold" style={{ color: ROLE_COLORS[myRole] }}>
              내 역할: {ROLE_LABELS[myRole]}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-[#8a96a8] flex items-center gap-2 justify-end">
              <ConnectionBadge status={connStatus} />
              <span>현재 주차</span>
            </div>
            <div className="text-3xl font-bold text-[#f4a261]">{team.currentWeek} / {config.weeks}</div>
          </div>
        </div>
        <div className="mt-3 h-2 bg-[#2c3a52] rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-[#f4a261] to-[#e76f51]"
               style={{ width: `${((team.currentWeek - 1) / config.weeks) * 100}%` }} />
        </div>
        <div className="mt-2 text-sm text-[#8a96a8]">
          팀 누적 비용: <span className="text-white font-semibold">${totalCost.toFixed(2)}</span>
        </div>
      </div>

      {/* 메인 — 내 역할 카드 */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-[#1a2332] border-2 rounded-2xl p-5"
             style={{ borderTopColor: ROLE_COLORS[myRole], borderTopWidth: '4px' }}>
          <h2 className="text-lg font-bold mb-3">내 운영 현황</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Stat label="현재 재고" value={myState.inventory}
                  color={myState.inventory > 20 ? '#e76f51' : myState.inventory > 0 ? '#2a9d8f' : '#8a96a8'} />
            <Stat label="백오더" value={myState.backlog}
                  color={myState.backlog > 0 ? '#e76f51' : '#2a9d8f'} />
            <Stat label="이번 주 입고" value={incomingShipment} />
            <Stat label={myRole === 'retailer' ? '고객 수요' : '하류 주문'}
                  value={lastIncomingOrder} />
            <Stat label="누적 비용" value={`$${myState.totalCost.toFixed(2)}`} />
            <Stat label="지난 주 주문" value={lastOrder} />
          </div>

          <PipeDisplay label="📦 배송 파이프라인 (앞→뒤, 곧 도착)"
                       items={myState.incomingShipments} />
          {myRole !== 'retailer' && (
            <PipeDisplay label="📋 주문 파이프라인"
                         items={myState.incomingOrders} />
          )}

          {/* 주문 입력 */}
          {!myPending ? (
            <form onSubmit={submitOrder} className="mt-4 bg-[#232f44] rounded-md p-4">
              <label className="block text-sm text-[#8a96a8] mb-2">
                {myRole === 'factory' ? '생산 주문' : `${ROLE_LABELS[upstreamRole]}에게 주문`}할 수량:
              </label>
              <div className="flex gap-2">
                <input
                  type="number" min={0} max={999} required autoFocus
                  value={orderInput}
                  onChange={e => setOrderInput(e.target.value)}
                  className="flex-1 bg-[#1a2332] border border-[#2c3a52] rounded-md px-4 py-3 text-xl"
                  placeholder="0"
                />
                <button type="submit" disabled={submitting || orderInput === ''}
                        className="bg-[#f4a261] text-black font-semibold px-6 py-3 rounded-md disabled:opacity-50">
                  {submitting ? '제출 중...' : '주문 제출'}
                </button>
              </div>
            </form>
          ) : (
            <div className="mt-4 bg-green-900/30 border border-green-700/50 rounded-md p-4 text-sm">
              ✓ 이번 주 주문 제출 완료. 다른 멤버를 기다리는 중...
            </div>
          )}
        </div>

        {/* 동료 상태 */}
        <div className="bg-[#1a2332] border border-[#2c3a52] rounded-2xl p-5">
          <h2 className="text-lg font-bold mb-3">팀원 상태</h2>
          <div className="space-y-2">
            {ROLE_ORDER.map(role => {
              const occ = teammates.find(o => o.role === role);
              const isMe = role === myRole;
              const submitted = team.submitted?.[role];
              return (
                <div key={role}
                     className={`p-3 rounded-md flex justify-between items-center ${isMe ? 'bg-[#2c3a52]' : 'bg-[#232f44]'}`}
                     style={isMe ? { borderLeft: `3px solid ${ROLE_COLORS[role]}` } : {}}>
                  <div>
                    <div className="text-sm font-semibold">{ROLE_LABELS[role]}{isMe ? ' (나)' : ''}</div>
                    <div className="text-xs text-[#8a96a8]">
                      {occ ? `${occ.name}${occ.isAi ? ' (AI)' : ''}` : '— 빈자리 —'}
                    </div>
                  </div>
                  <div className={`text-xs px-2 py-1 rounded ${submitted ? 'bg-green-900/40 text-green-300' : 'bg-[#2c3a52] text-[#8a96a8]'}`}>
                    {submitted ? '제출 ✓' : '대기'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 상태 메시지 */}
      {statusMsg && (
        <div className={`p-3 rounded-md text-sm ${
          statusMsg.type === 'error' ? 'bg-red-900/30 border border-red-700/50' :
          statusMsg.type === 'warn' ? 'bg-yellow-900/30 border border-yellow-700/50' :
          'bg-blue-900/30 border border-blue-700/50'
        }`}>
          {statusMsg.text}
        </div>
      )}

      {/* 차트 */}
      {team.history.length > 0 && (
        <ChartsSection history={team.history} info={config.info} myRole={myRole} />
      )}
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div className="bg-[#0f1419] rounded-md p-3">
      <div className="text-[10px] text-[#8a96a8] uppercase tracking-wider">{label}</div>
      <div className="text-2xl font-bold" style={color ? { color } : {}}>{value}</div>
    </div>
  );
}

function PipeDisplay({ label, items }) {
  return (
    <div className="mt-3 bg-[#0f1419] rounded-md p-2 text-xs font-mono">
      <span className="text-[#8a96a8]">{label}:</span>{' '}
      {items.length > 0
        ? items.map((v, i) => <span key={i}>{v}{i < items.length - 1 ? ' → ' : ''}</span>)
        : <span className="text-[#5a6a82]">비어있음</span>}
    </div>
  );
}

function ChartsSection({ history, info, myRole }) {
  // info 모드에 따라 표시할 역할 필터링
  const requested = info === 'partial'
    ? [myRole]
    : info === 'full'
      ? [myRole, downstreamOf(myRole), upstreamOf(myRole)].filter(Boolean)
      : ROLE_ORDER;
  // 서버가 마스킹하므로 history에 실제로 존재하는 역할만 차트에 사용
  const present = history[0]?.roles || {};
  const visibleRoles = requested.filter(r => present[r]);

  const labels = history.map(h => `W${h.week}`);
  const datasets = (key) => visibleRoles.map(role => ({
    label: ROLE_LABELS[role],
    data: history.map(h => h.roles[role][key]),
    borderColor: ROLE_COLORS[role],
    backgroundColor: ROLE_COLORS[role] + '33',
    tension: 0.2,
    borderWidth: 2,
    pointRadius: 1
  }));

  const chartOpts = (title) => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: { display: true, text: title, color: '#e7eaee' },
      legend: { labels: { color: '#e7eaee', font: { size: 11 } } }
    },
    scales: {
      x: { ticks: { color: '#8a96a8' }, grid: { color: '#2c3a52' } },
      y: { ticks: { color: '#8a96a8' }, grid: { color: '#2c3a52' } }
    }
  });

  return (
    <details className="bg-[#1a2332] border border-[#2c3a52] rounded-2xl p-4">
      <summary className="cursor-pointer text-[#f4a261] font-semibold">📊 차트 보기 ({info === 'partial' ? '내 단계만' : info === 'full' ? '인접 단계' : '전체'})</summary>
      <div className="grid md:grid-cols-2 gap-4 mt-3">
        <div className="h-64"><Line data={{ labels, datasets: datasets('order') }} options={chartOpts('주문량')} /></div>
        <div className="h-64"><Line data={{ labels, datasets: datasets('inventory') }} options={chartOpts('재고')} /></div>
        <div className="h-64"><Line data={{ labels, datasets: datasets('backlog') }} options={chartOpts('백오더')} /></div>
        <div className="h-64"><Line data={{ labels, datasets: datasets('totalCost') }} options={chartOpts('누적 비용 ($)')} /></div>
      </div>
    </details>
  );
}

function downstreamOf(role) {
  const idx = ROLE_ORDER.indexOf(role);
  return idx <= 0 ? null : ROLE_ORDER[idx - 1];
}
function upstreamOf(role) {
  const idx = ROLE_ORDER.indexOf(role);
  return idx === ROLE_ORDER.length - 1 ? null : ROLE_ORDER[idx + 1];
}
