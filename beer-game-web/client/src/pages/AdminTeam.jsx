import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  Title, Tooltip, Legend
} from 'chart.js';
import { api } from '../lib/api.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const ROLE_LABELS = {
  retailer: '소매상', wholesaler: '도매상', distributor: '유통업자', factory: '공장'
};
const ROLE_COLORS = {
  retailer: '#e76f51', wholesaler: '#f4a261', distributor: '#e9c46a', factory: '#2a9d8f'
};
const ROLES = ['retailer', 'wholesaler', 'distributor', 'factory'];

export default function AdminTeam() {
  const { sessionId, teamId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const adminToken = sessionStorage.getItem(`admin:${sessionId}`);

  async function refresh() {
    if (!adminToken) { setError('관리자 토큰이 없습니다.'); return; }
    try {
      const d = await api.getTeamDetail(sessionId, teamId, adminToken);
      setData(d);
      setError(null);
    } catch (err) { setError(err.message); }
  }

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 3000);
    return () => clearInterval(id);
  }, [sessionId, teamId, adminToken]);

  async function handleForceAdvance() {
    if (!confirm(`${data.name}을(를) 강제 진행합니다.`)) return;
    setBusy(true);
    try { await api.forceAdvance(sessionId, teamId, adminToken); await refresh(); }
    catch (err) { alert('실패: ' + err.message); }
    finally { setBusy(false); }
  }

  if (error) return <div className="bg-red-900/30 border border-red-600 rounded-md p-4">{error}</div>;
  if (!data) return <div className="text-[#8a96a8]">로딩 중...</div>;

  const config = data.sessionConfig;
  const totalCost = ROLES.reduce((s, r) => s + (data.state.roles[r]?.totalCost || 0), 0);
  const labels = data.history.map(h => `W${h.week}`);
  const customerDemands = data.history.map(h => h.customerDemand);

  const datasets = (key) => ROLES.map(role => ({
    label: ROLE_LABELS[role],
    data: data.history.map(h => h.roles[role][key]),
    borderColor: ROLE_COLORS[role],
    backgroundColor: ROLE_COLORS[role] + '33',
    tension: 0.2,
    borderWidth: 2,
    pointRadius: 1
  }));

  const orderDataset = [
    ...datasets('order'),
    {
      label: '고객 수요',
      data: customerDemands,
      borderColor: '#ffffff',
      borderDash: [4, 4],
      borderWidth: 2,
      pointRadius: 1
    }
  ];

  const chartOpts = (title) => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: { display: true, text: title, color: '#e7eaee', font: { size: 13, weight: 'bold' } },
      legend: { labels: { color: '#e7eaee', font: { size: 10 } } }
    },
    scales: {
      x: { ticks: { color: '#8a96a8' }, grid: { color: '#2c3a52' } },
      y: { ticks: { color: '#8a96a8' }, grid: { color: '#2c3a52' } }
    }
  });

  return (
    <div className="space-y-4">
      {/* 상단 헤더 + 액션 */}
      <div className="bg-[#1a2332] border border-[#2c3a52] rounded-2xl p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <Link to={`/admin/${sessionId}`} className="text-sm text-[#8a96a8] hover:text-white">
              ← 세션 대시보드로
            </Link>
            <h1 className="text-2xl font-bold mt-1">{data.name}</h1>
            <div className="text-sm text-[#8a96a8]">
              주 {data.currentWeek} / {config.weeks}
              {data.isFinished && <span className="ml-2 px-2 py-0.5 bg-green-900/50 text-green-300 rounded text-xs">완료</span>}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-[#8a96a8]">팀 누적 비용</div>
            <div className="text-3xl font-bold text-[#f4a261]">${totalCost.toFixed(2)}</div>
            {!data.isFinished && (
              <button onClick={handleForceAdvance} disabled={busy}
                      className="mt-2 text-xs bg-yellow-900/40 text-yellow-200 hover:bg-yellow-900/60 px-3 py-1 rounded">
                ⚡ 강제 진행
              </button>
            )}
          </div>
        </div>
        <div className="mt-3 h-2 bg-[#2c3a52] rounded-full overflow-hidden">
          <div className="h-full bg-[#f4a261]"
               style={{ width: `${((data.currentWeek - 1) / config.weeks) * 100}%` }} />
        </div>
      </div>

      {/* 4역할 카드 */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
        {ROLES.map(role => {
          const r = data.state.roles[role];
          const occ = data.occupants.find(o => o.role === role);
          const submitted = data.pendingOrders?.[role] != null;
          const lastOrder = r.orderHistory.length > 0 ? r.orderHistory[r.orderHistory.length - 1] : '—';
          return (
            <div key={role} className="bg-[#1a2332] border-t-4 border border-[#2c3a52] rounded-xl p-4"
                 style={{ borderTopColor: ROLE_COLORS[role] }}>
              <div className="flex items-center justify-between">
                <div className="font-bold text-base" style={{ color: ROLE_COLORS[role] }}>
                  {ROLE_LABELS[role]}
                </div>
                {submitted && <span className="text-xs px-2 py-0.5 bg-green-900/40 text-green-300 rounded">제출 ✓</span>}
              </div>
              <div className="text-xs text-[#8a96a8] mt-1">
                {occ ? `${occ.name}${occ.isAi ? ' (AI)' : ''}` : '— 빈 자리 —'}
              </div>

              <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
                <Mini label="재고" value={r.inventory}
                      good={r.inventory > 0 && r.inventory <= 30} />
                <Mini label="백오더" value={r.backlog} bad={r.backlog > 0} />
                <Mini label="누적비용" value={`$${r.totalCost.toFixed(0)}`} />
                <Mini label="지난주 주문" value={lastOrder} />
              </div>

              <div className="mt-2 text-xs">
                <div className="text-[#8a96a8]">📦 입고 큐:</div>
                <div className="font-mono">{r.incomingShipments.join(' → ') || '—'}</div>
                {role !== 'retailer' && (
                  <>
                    <div className="text-[#8a96a8] mt-1">📋 주문 큐:</div>
                    <div className="font-mono">{r.incomingOrders.join(' → ') || '—'}</div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 차트 */}
      {data.history.length > 0 && (
        <div className="bg-[#1a2332] border border-[#2c3a52] rounded-2xl p-4">
          <h2 className="text-base font-bold mb-3 text-[#f4a261]">📈 시계열 차트</h2>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="h-64"><Line data={{ labels, datasets: orderDataset }} options={chartOpts('주문량')} /></div>
            <div className="h-64"><Line data={{ labels, datasets: datasets('inventory') }} options={chartOpts('재고')} /></div>
            <div className="h-64"><Line data={{ labels, datasets: datasets('backlog') }} options={chartOpts('백오더')} /></div>
            <div className="h-64"><Line data={{ labels, datasets: datasets('totalCost') }} options={chartOpts('누적 비용')} /></div>
          </div>
        </div>
      )}

      {/* 종합 통계 */}
      {data.summary && (
        <div className="bg-[#1a2332] border border-[#2c3a52] rounded-2xl p-4">
          <h2 className="text-base font-bold mb-3 text-[#f4a261]">📊 종합 통계</h2>
          <div className="text-sm text-[#8a96a8] mb-2">
            고객 수요 표준편차: {data.summary.customerDemandStd.toFixed(2)} ·
            최대 채찍효과 증폭: <strong className="text-white">{data.summary.maxAmplification.toFixed(2)}배</strong>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[#8a96a8] text-xs">
                <th className="text-left p-1">역할</th>
                <th className="text-left p-1">총 비용</th>
                <th className="text-left p-1">최대 재고</th>
                <th className="text-left p-1">최대 백오더</th>
                <th className="text-left p-1">주문 표준편차</th>
                <th className="text-left p-1">증폭률</th>
              </tr>
            </thead>
            <tbody>
              {ROLES.map(r => {
                const s = data.summary.perRole[r];
                return (
                  <tr key={r} className="border-t border-[#2c3a52]">
                    <td className="p-1 font-semibold" style={{ color: ROLE_COLORS[r] }}>{ROLE_LABELS[r]}</td>
                    <td className="p-1">${s.totalCost.toFixed(2)}</td>
                    <td className="p-1">{s.maxInventory}</td>
                    <td className="p-1">{s.maxBacklog}</td>
                    <td className="p-1">{s.orderStd.toFixed(2)}</td>
                    <td className="p-1">{s.amplification.toFixed(2)}배</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 주차별 히스토리 */}
      {data.history.length > 0 && (
        <details className="bg-[#1a2332] border border-[#2c3a52] rounded-2xl p-4">
          <summary className="cursor-pointer text-[#f4a261] font-semibold">📜 주차별 상세 (펼치기)</summary>
          <div className="overflow-x-auto mt-3">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="text-[#8a96a8] border-b border-[#2c3a52]">
                  <th className="text-left p-1">주</th>
                  <th className="text-left p-1">고객</th>
                  {ROLES.map(r => (
                    <th key={r} className="text-left p-1" style={{ color: ROLE_COLORS[r] }}>
                      {ROLE_LABELS[r].slice(0, 2)}.주문/재고/백오더
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.history.map(h => (
                  <tr key={h.week} className="border-b border-[#232f44]">
                    <td className="p-1 font-semibold">{h.week}</td>
                    <td className="p-1">{h.customerDemand}</td>
                    {ROLES.map(r => {
                      const d = h.roles[r];
                      return (
                        <td key={r} className="p-1">
                          {d.order}/{d.inventory}/{d.backlog}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}

function Mini({ label, value, good, bad }) {
  return (
    <div className="bg-[#0f1419] rounded p-2">
      <div className="text-[10px] text-[#8a96a8]">{label}</div>
      <div className={`font-bold ${bad ? 'text-[#e76f51]' : good ? 'text-[#2a9d8f]' : ''}`}>{value}</div>
    </div>
  );
}
