import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement, BarElement,
  Title, Tooltip, Legend
} from 'chart.js';
import { connectAsPlayer } from '../lib/socket.js';
import { api } from '../lib/api.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend);

const ROLE_LABELS = {
  retailer: '소매상', wholesaler: '도매상', distributor: '유통업자', factory: '공장'
};
const ROLE_COLORS = {
  retailer: '#e76f51', wholesaler: '#f4a261', distributor: '#e9c46a', factory: '#2a9d8f'
};
const ROLE_ORDER = ['retailer', 'wholesaler', 'distributor', 'factory'];
const TEAM_PALETTE = [
  '#e76f51', '#f4a261', '#e9c46a', '#2a9d8f', '#264653',
  '#8338ec', '#ff006e', '#3a86ff', '#fb5607', '#06ffa5',
  '#c77dff', '#ffbe0b', '#ff595e', '#1982c4', '#6a4c93',
  '#a8dadc', '#e63946', '#457b9d', '#f1faee', '#bc6c25'
];

export default function Results() {
  const navigate = useNavigate();
  const [me, setMe] = useState(null);
  const [team, setTeam] = useState(null);
  const [session, setSession] = useState(null);
  const [comparison, setComparison] = useState(null); // 다른 팀들 결과
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('player_token');
    if (!token) { navigate('/join'); return; }

    const socket = connectAsPlayer(token);
    socket.on('connect_error', err => setError('연결 실패: ' + err.message));
    socket.on('state:full', async (data) => {
      setMe(data.me);
      setTeam(data.team);
      setSession(data.session);
      // 같은 세션의 결과 비교 데이터
      try {
        const r = await api.getSessionResults(data.session.code);
        setComparison(r);
      } catch (_) {}
    });

    return () => socket.disconnect();
  }, [navigate]);

  // 비교 데이터를 주기적으로 새로고침 (다른 팀이 완료될 때마다)
  useEffect(() => {
    if (!session) return;
    const id = setInterval(async () => {
      try {
        const r = await api.getSessionResults(session.code);
        setComparison(r);
      } catch (_) {}
    }, 5000);
    return () => clearInterval(id);
  }, [session?.code]);

  // 모든 메트릭 계산은 useMemo로
  const metrics = useMemo(() => {
    if (!team || !comparison) return null;

    const myStats = computeTeamStats(team);
    const otherTeams = comparison.teams.filter(t => t.id !== team.teamId);
    const allTeams = comparison.teams; // includes me

    // 우리 팀 vs 전체 평균/순위
    const sortedByCost = [...allTeams].sort((a, b) => a.summary.totalCost - b.summary.totalCost);
    const myRank = sortedByCost.findIndex(t => t.id === team.teamId) + 1;
    const avgCost = allTeams.reduce((s, t) => s + t.summary.totalCost, 0) / allTeams.length;

    return {
      myStats,
      otherTeams,
      allTeams,
      myRank,
      totalTeams: allTeams.length,
      avgCost
    };
  }, [team, comparison]);

  if (error) return <div className="bg-red-900/30 border border-red-600 rounded-md p-4">{error}</div>;
  if (!team || !session) return <div className="text-[#8a96a8]">로딩 중...</div>;

  const history = team.history || [];
  const labels = history.map(h => `W${h.week}`);
  const customerDemands = history.map(h => h.customerDemand);
  const totalCost = ROLE_ORDER.reduce((s, r) => s + team.state.roles[r].totalCost, 0);
  const customerStd = stddev(customerDemands);
  const roleStds = ROLE_ORDER.map(r => ({
    role: r,
    std: stddev(team.state.roles[r].orderHistory)
  }));
  const maxAmp = Math.max(...roleStds.map(s => s.std)) / Math.max(customerStd, 0.01);

  const myDatasets = (key) => ROLE_ORDER.map(role => ({
    label: ROLE_LABELS[role],
    data: history.map(h => h.roles[role][key]),
    borderColor: ROLE_COLORS[role],
    backgroundColor: ROLE_COLORS[role] + '33',
    tension: 0.2,
    borderWidth: 2,
    pointRadius: 1
  }));
  const myOrdersDataset = [
    ...myDatasets('order'),
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
    responsive: true, maintainAspectRatio: false,
    plugins: {
      title: { display: true, text: title, color: '#e7eaee', font: { size: 14, weight: 'bold' } },
      legend: { labels: { color: '#e7eaee', font: { size: 11 } } }
    },
    scales: {
      x: { ticks: { color: '#8a96a8' }, grid: { color: '#2c3a52' } },
      y: { ticks: { color: '#8a96a8' }, grid: { color: '#2c3a52' } }
    }
  });

  function exportCsv() {
    let csv = 'Week,CustomerDemand';
    ROLE_ORDER.forEach(r => {
      csv += `,${r}_Order,${r}_Inventory,${r}_Backlog,${r}_TotalCost,${r}_Shipped`;
    });
    csv += '\n';
    history.forEach(h => {
      let row = `${h.week},${h.customerDemand}`;
      ROLE_ORDER.forEach(r => {
        const d = h.roles[r];
        row += `,${d.order},${d.inventory},${d.backlog},${d.totalCost.toFixed(2)},${d.shipped}`;
      });
      csv += row + '\n';
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `beer_game_${team.name}_${session.code}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function leave() {
    localStorage.removeItem('player_token');
    localStorage.removeItem('player_session');
    navigate('/');
  }

  // 헤더 -----------------------------------------------------------------
  return (
    <div className="space-y-4">
      <div className="bg-[#1a2332] border border-[#2c3a52] rounded-2xl p-6">
        <h1 className="text-2xl font-bold mb-2">🏁 {team.name} — 게임 종료</h1>
        <div className="flex flex-wrap gap-4 text-sm">
          <div>
            <span className="text-[#8a96a8]">우리 팀 누적 비용: </span>
            <strong className="text-[#f4a261] text-lg">${totalCost.toFixed(2)}</strong>
          </div>
          <div>
            <span className="text-[#8a96a8]">채찍효과 최대 증폭: </span>
            <strong className="text-white">{maxAmp.toFixed(2)}배</strong>
          </div>
          {metrics && metrics.totalTeams > 1 && (
            <div>
              <span className="text-[#8a96a8]">우리 팀 순위: </span>
              <strong className="text-white">{metrics.myRank} / {metrics.totalTeams}</strong>
              <span className="text-[#8a96a8] ml-2">(반 평균 ${metrics.avgCost.toFixed(0)})</span>
            </div>
          )}
        </div>
      </div>

      {/* 성취 배지 */}
      {metrics && metrics.totalTeams > 1 && (
        <Achievements metrics={metrics} myTeamId={team.teamId} myStats={metrics.myStats} />
      )}

      {/* 점수판 */}
      <div className="bg-[#1a2332] border border-[#2c3a52] rounded-2xl p-6">
        <h2 className="text-lg font-bold mb-3 text-[#f4a261]">최종 점수판 (우리 팀)</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[#8a96a8]">
              <th className="text-left p-2">역할</th>
              <th className="text-left p-2">총 비용</th>
              <th className="text-left p-2">최대 재고</th>
              <th className="text-left p-2">최대 백오더</th>
              <th className="text-left p-2">주문 변동성*</th>
              <th className="text-left p-2">채찍효과 증폭</th>
            </tr>
          </thead>
          <tbody>
            {ROLE_ORDER.map(r => {
              const role = team.state.roles[r];
              const std = stddev(role.orderHistory);
              const amp = customerStd > 0 ? std / customerStd : 0;
              return (
                <tr key={r} className="border-t border-[#2c3a52]">
                  <td className="p-2 font-semibold" style={{ color: ROLE_COLORS[r] }}>{ROLE_LABELS[r]}</td>
                  <td className="p-2">${role.totalCost.toFixed(2)}</td>
                  <td className="p-2">{Math.max(0, ...role.inventoryHistory)}</td>
                  <td className="p-2">{Math.max(0, ...role.backlogHistory)}</td>
                  <td className="p-2">{std.toFixed(2)}</td>
                  <td className="p-2">{amp.toFixed(2)}배</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[#f4a261] font-bold">
              <td className="p-2">총합</td>
              <td className="p-2 text-[#f4a261]">${totalCost.toFixed(2)}</td>
              <td colSpan={4} />
            </tr>
          </tfoot>
        </table>
        <p className="text-xs text-[#8a96a8] mt-2">* 표준편차 (낮을수록 안정적)</p>
      </div>

      {/* 우리 팀 차트 */}
      <div className="bg-[#1a2332] border border-[#2c3a52] rounded-2xl p-6">
        <h2 className="text-lg font-bold mb-3 text-[#f4a261]">📈 우리 팀 시각화</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="h-72"><Line data={{ labels, datasets: myOrdersDataset }} options={chartOpts('주문량')} /></div>
          <div className="h-72"><Line data={{ labels, datasets: myDatasets('inventory') }} options={chartOpts('재고')} /></div>
          <div className="h-72"><Line data={{ labels, datasets: myDatasets('backlog') }} options={chartOpts('백오더')} /></div>
          <div className="h-72"><Line data={{ labels, datasets: myDatasets('totalCost') }} options={chartOpts('누적 비용')} /></div>
        </div>
      </div>

      {/* 팀 비교 */}
      {metrics && metrics.allTeams.length > 1 && (
        <>
          <BullwhipComparisonChart teams={metrics.allTeams} myTeamId={team.teamId} customerStd={customerStd} />
          <CostTrajectoryChart teams={metrics.allTeams} myTeamId={team.teamId} weeks={session.config.weeks} />
          <TeamRankingTable teams={metrics.allTeams} myTeamId={team.teamId} />
        </>
      )}

      {/* 학습 포인트 */}
      <Insights team={team} customerStd={customerStd} roleStds={roleStds} maxAmp={maxAmp} metrics={metrics} />

      <div className="flex gap-2 flex-wrap">
        <button onClick={exportCsv}
                className="bg-[#232f44] border border-[#2c3a52] text-white px-4 py-2 rounded-md">
          📁 CSV 내보내기
        </button>
        <button onClick={leave}
                className="bg-[#f4a261] text-black font-semibold px-4 py-2 rounded-md">
          나가기
        </button>
      </div>
    </div>
  );
}

// 성취 배지 ---------------------------------------------------------------
function Achievements({ metrics, myTeamId, myStats }) {
  const badges = [];
  const all = metrics.allTeams;
  const me = all.find(t => t.id === myTeamId);
  if (!me) return null;

  // 1. 최저 비용 (우승)
  const lowestCost = Math.min(...all.map(t => t.summary.totalCost));
  if (Math.abs(me.summary.totalCost - lowestCost) < 0.01) {
    badges.push({ icon: '🏆', title: '최저 비용', desc: '반에서 가장 효율적인 운영' });
  }
  // 2. 최저 채찍효과
  const lowestAmp = Math.min(...all.map(t => t.summary.maxAmplification));
  if (Math.abs(me.summary.maxAmplification - lowestAmp) < 0.01) {
    badges.push({ icon: '📊', title: '안정적 주문', desc: '채찍효과를 가장 잘 억제' });
  }
  // 3. 평균 이하 비용
  if (me.summary.totalCost < metrics.avgCost) {
    badges.push({ icon: '💰', title: '평균 이하 비용', desc: `반 평균 $${metrics.avgCost.toFixed(0)}보다 낮음` });
  }
  // 4. 백오더 적음
  const myMaxBack = Math.max(...ROLE_ORDER.map(r => me.summary.perRole[r].maxBacklog));
  const allMaxBack = all.map(t => Math.max(...ROLE_ORDER.map(r => t.summary.perRole[r].maxBacklog)));
  const minMaxBack = Math.min(...allMaxBack);
  if (myMaxBack === minMaxBack && myMaxBack < 20) {
    badges.push({ icon: '🚚', title: '품절 없음', desc: '고객을 가장 잘 만족시킴' });
  }
  // 5. 재고 효율
  const myMaxInv = Math.max(...ROLE_ORDER.map(r => me.summary.perRole[r].maxInventory));
  const allMaxInv = all.map(t => Math.max(...ROLE_ORDER.map(r => t.summary.perRole[r].maxInventory)));
  const minMaxInv = Math.min(...allMaxInv);
  if (myMaxInv === minMaxInv) {
    badges.push({ icon: '📦', title: '재고 효율', desc: '재고 누적이 가장 적음' });
  }
  // 6. 1등이 아니면 격려
  if (badges.length === 0) {
    if (metrics.myRank > metrics.totalTeams / 2) {
      badges.push({ icon: '🌱', title: '학습의 기회', desc: '다른 팀의 전략을 분석해보세요' });
    } else {
      badges.push({ icon: '👍', title: '상위권', desc: `${metrics.totalTeams}팀 중 ${metrics.myRank}위` });
    }
  }

  return (
    <div className="bg-[#1a2332] border border-[#2c3a52] rounded-2xl p-5">
      <h2 className="text-lg font-bold mb-3 text-[#f4a261]">🎖 성취 배지</h2>
      <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
        {badges.map((b, i) => (
          <div key={i} className="bg-[#232f44] border border-[#2c3a52] rounded-lg p-3">
            <div className="text-2xl">{b.icon}</div>
            <div className="font-semibold mt-1">{b.title}</div>
            <div className="text-xs text-[#8a96a8] mt-1">{b.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// 채찍효과 비교 막대그래프 ------------------------------------------------
function BullwhipComparisonChart({ teams, myTeamId, customerStd }) {
  const labels = ROLE_ORDER.map(r => ROLE_LABELS[r]);
  const datasets = teams.map((t, i) => {
    const isMe = t.id === myTeamId;
    return {
      label: t.name + (isMe ? ' (우리)' : ''),
      data: ROLE_ORDER.map(r => t.summary.perRole[r].orderStd),
      backgroundColor: isMe ? '#f4a261' : (TEAM_PALETTE[i % TEAM_PALETTE.length] + '99'),
      borderColor: isMe ? '#e76f51' : TEAM_PALETTE[i % TEAM_PALETTE.length],
      borderWidth: isMe ? 3 : 1
    };
  });

  return (
    <div className="bg-[#1a2332] border border-[#2c3a52] rounded-2xl p-5">
      <h2 className="text-lg font-bold mb-1 text-[#f4a261]">📊 팀별 채찍효과 비교</h2>
      <p className="text-xs text-[#8a96a8] mb-3">
        역할별 주문 변동성(표준편차). 고객 수요 변동성 기준선: <strong>{customerStd.toFixed(2)}</strong>.
        막대가 높을수록 채찍효과가 큼.
      </p>
      <div className="h-72">
        <Bar data={{ labels, datasets }}
             options={{
               responsive: true, maintainAspectRatio: false,
               plugins: {
                 legend: { labels: { color: '#e7eaee', font: { size: 11 } }, position: 'right' }
               },
               scales: {
                 x: { ticks: { color: '#e7eaee' }, grid: { color: '#2c3a52' } },
                 y: { ticks: { color: '#8a96a8' }, grid: { color: '#2c3a52' },
                      title: { display: true, text: '주문 표준편차', color: '#8a96a8' } }
               }
             }} />
      </div>
    </div>
  );
}

// 비용 추이 비교 차트 ----------------------------------------------------
function CostTrajectoryChart({ teams, myTeamId, weeks }) {
  const labels = Array.from({ length: weeks }, (_, i) => `W${i + 1}`);
  const datasets = teams.map((t, i) => {
    const isMe = t.id === myTeamId;
    const data = labels.map((_, idx) => {
      const h = t.history[idx];
      if (!h) return null;
      return ROLE_ORDER.reduce((s, r) => s + h.roles[r].totalCost, 0);
    });
    return {
      label: t.name + (isMe ? ' (우리)' : ''),
      data,
      borderColor: isMe ? '#f4a261' : TEAM_PALETTE[i % TEAM_PALETTE.length],
      backgroundColor: isMe ? '#f4a26133' : TEAM_PALETTE[i % TEAM_PALETTE.length] + '22',
      tension: 0.2,
      borderWidth: isMe ? 4 : 2,
      pointRadius: isMe ? 2 : 1,
      spanGaps: true
    };
  });

  return (
    <div className="bg-[#1a2332] border border-[#2c3a52] rounded-2xl p-5">
      <h2 className="text-lg font-bold mb-3 text-[#f4a261]">💰 팀별 누적 비용 추이</h2>
      <div className="h-72">
        <Line data={{ labels, datasets }}
              options={{
                responsive: true, maintainAspectRatio: false,
                plugins: {
                  legend: { labels: { color: '#e7eaee', font: { size: 11 } }, position: 'right' }
                },
                scales: {
                  x: { ticks: { color: '#8a96a8' }, grid: { color: '#2c3a52' } },
                  y: { ticks: { color: '#8a96a8' }, grid: { color: '#2c3a52' } }
                }
              }} />
      </div>
    </div>
  );
}

// 팀 순위 표 ------------------------------------------------------------
function TeamRankingTable({ teams, myTeamId }) {
  const sorted = [...teams].sort((a, b) => a.summary.totalCost - b.summary.totalCost);
  return (
    <div className="bg-[#1a2332] border border-[#2c3a52] rounded-2xl p-5">
      <h2 className="text-lg font-bold mb-3 text-[#f4a261]">🏆 팀 순위</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[#8a96a8] text-xs">
            <th className="text-left p-2">순위</th>
            <th className="text-left p-2">팀</th>
            <th className="text-left p-2">총 비용</th>
            <th className="text-left p-2">최대 채찍효과</th>
            <th className="text-left p-2">최대 재고/백오더</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((t, i) => {
            const isMe = t.id === myTeamId;
            const maxInv = Math.max(...ROLE_ORDER.map(r => t.summary.perRole[r].maxInventory));
            const maxBack = Math.max(...ROLE_ORDER.map(r => t.summary.perRole[r].maxBacklog));
            return (
              <tr key={t.id} className={`border-t border-[#2c3a52] ${isMe ? 'bg-[#232f44]' : ''}`}>
                <td className="p-2 font-bold">
                  {i === 0 && '🥇'}{i === 1 && '🥈'}{i === 2 && '🥉'}{i > 2 && (i + 1)}
                </td>
                <td className="p-2 font-semibold">{t.name}{isMe && ' (우리)'}</td>
                <td className="p-2">${t.summary.totalCost.toFixed(2)}</td>
                <td className="p-2">{t.summary.maxAmplification.toFixed(2)}배</td>
                <td className="p-2 text-xs">재고 {maxInv} / 백 {maxBack}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// 인사이트 + 학습 포인트 ----------------------------------------------------
function Insights({ team, customerStd, roleStds, maxAmp, metrics }) {
  // 우리 팀 데이터에서 자동으로 인사이트 추출
  const observations = [];

  // 1. 채찍효과 가장 큰 역할
  const sortedByStd = [...roleStds].sort((a, b) => b.std - a.std);
  const worst = sortedByStd[0];
  observations.push({
    icon: '🔍',
    title: `채찍효과가 가장 큰 역할: ${ROLE_LABELS[worst.role]}`,
    body: `${ROLE_LABELS[worst.role]}의 주문 변동성이 ${worst.std.toFixed(2)}로 고객 수요(${customerStd.toFixed(2)})보다 ${(worst.std/Math.max(customerStd,0.01)).toFixed(1)}배 큽니다. ${
      worst.role === 'factory' ? '공급사슬의 끝단이라 작은 변동도 크게 증폭됐습니다.' :
      worst.role === 'retailer' ? '고객 수요를 직접 받는 단계인데도 변동이 큰 건 과잉반응(panic ordering) 가능성이 있습니다.' :
      '중간 단계는 상하류 신호를 모두 받기 때문에 노이즈가 누적됩니다.'
    }`
  });

  // 2. 비용 구성 — 재고 vs 백오더
  let totalHoldCost = 0, totalBackCost = 0;
  ROLE_ORDER.forEach(r => {
    const role = team.state.roles[r];
    role.inventoryHistory.forEach(v => totalHoldCost += v); // 단가 곱은 일정하니 비율 계산용
    role.backlogHistory.forEach(v => totalBackCost += v * 2); // 백오더 단가가 보통 2배
  });
  const holdRatio = totalHoldCost / Math.max(totalHoldCost + totalBackCost, 1);
  observations.push({
    icon: '⚖️',
    title: holdRatio > 0.7 ? '비용 대부분이 재고에서 발생' : holdRatio < 0.3 ? '비용 대부분이 품절(백오더)에서 발생' : '재고와 백오더 비용이 균형',
    body: holdRatio > 0.7
      ? '과도한 재고 누적 — 안전재고를 줄이거나 주문량을 더 신중히 결정하면 비용을 줄일 수 있었습니다.'
      : holdRatio < 0.3
        ? '품절이 잦았습니다 — 시작 재고나 안전재고를 늘리는 보수적 전략이 필요했을 수 있습니다.'
        : '재고와 백오더 사이 트레이드오프를 잘 다뤘습니다. 다만 둘 모두 비용이라 더 줄일 여지가 있습니다.'
  });

  // 3. 우리 팀 vs 다른 팀
  if (metrics && metrics.totalTeams > 1) {
    const me = metrics.allTeams.find(t => t.id === team.teamId);
    const others = metrics.allTeams.filter(t => t.id !== team.teamId);
    const myAmp = me.summary.maxAmplification;
    const otherAvgAmp = others.reduce((s, t) => s + t.summary.maxAmplification, 0) / others.length;
    if (myAmp < otherAvgAmp * 0.8) {
      observations.push({
        icon: '🎯',
        title: '다른 팀 대비 채찍효과 억제 우수',
        body: `우리 팀의 최대 증폭은 ${myAmp.toFixed(1)}배로 다른 팀 평균(${otherAvgAmp.toFixed(1)}배)보다 낮습니다. 일관된 주문 정책의 효과입니다.`
      });
    } else if (myAmp > otherAvgAmp * 1.2) {
      observations.push({
        icon: '⚠️',
        title: '다른 팀 대비 채찍효과 더 큼',
        body: `우리 팀의 최대 증폭은 ${myAmp.toFixed(1)}배로 다른 팀 평균(${otherAvgAmp.toFixed(1)}배)보다 큽니다. 1위 팀의 주문 패턴을 비교해보면 도움이 됩니다.`
      });
    }
  }

  return (
    <div className="bg-[#1a2332] border border-[#2c3a52] rounded-2xl p-6">
      <h2 className="text-lg font-bold mb-3 text-[#f4a261]">💡 우리 팀 인사이트</h2>
      <div className="space-y-3">
        {observations.map((o, i) => (
          <div key={i} className="border-l-2 border-[#f4a261] pl-3 py-1">
            <div className="font-semibold">
              <span className="mr-1">{o.icon}</span>{o.title}
            </div>
            <div className="text-sm text-[#e7eaee] mt-1">{o.body}</div>
          </div>
        ))}

        <div className="border-l-2 border-[#2a9d8f] pl-3 py-1 mt-4">
          <div className="font-semibold">🎓 일반 학습 포인트</div>
          <ul className="list-disc ml-5 mt-1 text-sm space-y-1">
            <li>각 단계가 자기 정보만 보고 결정하면 시스템 전체가 비효율적이 됩니다.</li>
            <li>주문/배송 지연은 시스템 동학을 불안정하게 만듭니다 — 짧은 리드타임이 핵심.</li>
            <li>해결책: ① POS 데이터 공유 (VMI, CPFR), ② 일관된 주문 정책 (base-stock), ③ 협력 예측.</li>
            <li>현실 적용: Walmart-P&G의 VMI 협력, Dell의 Build-to-Order, Zara의 Quick Response.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// 헬퍼
function stddev(arr) {
  if (!arr || arr.length === 0) return 0;
  const m = arr.reduce((a, b) => a + b, 0) / arr.length;
  return Math.sqrt(arr.reduce((s, x) => s + (x - m) ** 2, 0) / arr.length);
}

function computeTeamStats(team) {
  return {
    totalCost: ROLE_ORDER.reduce((s, r) => s + team.state.roles[r].totalCost, 0),
    maxInventory: Math.max(...ROLE_ORDER.flatMap(r => team.state.roles[r].inventoryHistory)),
    maxBacklog: Math.max(...ROLE_ORDER.flatMap(r => team.state.roles[r].backlogHistory))
  };
}
