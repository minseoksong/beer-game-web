import { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  Title, Tooltip, Legend
} from 'chart.js';
import { api } from '../lib/api.js';
import { connectAsAdmin } from '../lib/socket.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const ROLE_LABELS = {
  retailer: '소매상', wholesaler: '도매상', distributor: '유통업자', factory: '공장'
};
const ROLES = ['retailer', 'wholesaler', 'distributor', 'factory'];
const ROLE_COLORS = {
  retailer: '#e76f51', wholesaler: '#f4a261', distributor: '#e9c46a', factory: '#2a9d8f'
};
// 팀별 색상 팔레트 (최대 20팀)
const TEAM_PALETTE = [
  '#e76f51', '#f4a261', '#e9c46a', '#2a9d8f', '#264653',
  '#8338ec', '#ff006e', '#3a86ff', '#fb5607', '#06ffa5',
  '#c77dff', '#ffbe0b', '#ff595e', '#1982c4', '#6a4c93',
  '#a8dadc', '#e63946', '#457b9d', '#f1faee', '#bc6c25'
];

export default function AdminSession() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const socketRef = useRef(null);

  const adminToken = sessionStorage.getItem(`admin:${sessionId}`);

  useEffect(() => {
    if (!adminToken) {
      setError('관리자 토큰이 없습니다. 세션을 새로 만들어주세요.');
      return;
    }

    api.getAdminSession(sessionId, adminToken).then(setData).catch(e => setError(e.message));

    const socket = connectAsAdmin(sessionId, adminToken);
    socketRef.current = socket;

    socket.on('admin:full', (snap) => {
      setData(d => ({
        ...(d || {}),
        id: snap.session.id,
        code: snap.session.code,
        config: snap.session.config,
        status: snap.session.status,
        teams: snap.teams.map(t => ({ ...t }))
      }));
    });

    socket.on('team:event', (evt) => {
      setData(d => {
        if (!d) return d;
        return {
          ...d,
          teams: d.teams.map(t => t.id === evt.teamId
            ? { ...t,
                currentWeek: evt.week ?? t.currentWeek,
                isFinished: evt.finished ?? t.isFinished,
                totalCost: evt.totalCost ?? t.totalCost }
            : t)
        };
      });
    });

    socket.on('session:started', () => {
      setData(d => d ? { ...d, status: 'running' } : d);
    });
    socket.on('session:finished', () => {
      setData(d => d ? { ...d, status: 'finished' } : d);
    });

    return () => socket.disconnect();
  }, [sessionId, adminToken]);

  // 주기적으로 REST에서 history 새로고침 (비교 차트용 — Socket으로 전체 데이터 주는 건 비효율)
  useEffect(() => {
    if (!data || data.status === 'lobby' || !adminToken) return;
    const id = setInterval(async () => {
      try {
        const fresh = await api.getAdminSession(sessionId, adminToken);
        setData(d => d ? { ...d, teams: fresh.teams } : fresh);
      } catch (_) {}
    }, 4000);
    return () => clearInterval(id);
  }, [data?.status, sessionId, adminToken]);

  async function handleStart() {
    if (!confirm('게임을 시작합니다. 빈 자리는 자동으로 AI로 채워집니다.')) return;
    setBusy(true);
    try { await api.startSession(sessionId, adminToken); }
    catch (err) { alert('시작 실패: ' + err.message); }
    finally { setBusy(false); }
  }

  async function handleFinish() {
    if (!confirm('게임을 강제 종료합니다. 정말 종료하시겠습니까?')) return;
    setBusy(true);
    try { await api.finishSession(sessionId, adminToken); }
    catch (err) { alert('종료 실패: ' + err.message); }
    finally { setBusy(false); }
  }

  async function handleForceAdvance(teamId, teamName) {
    if (!confirm(`${teamName}을(를) 강제 진행합니다. 미제출자는 AI로 즉시 대체됩니다.`)) return;
    try { await api.forceAdvance(sessionId, teamId, adminToken); }
    catch (err) { alert('강제 진행 실패: ' + err.message); }
  }

  // 요약 통계 계산 ---------------------------------------------------------
  const summary = useMemo(() => {
    if (!data) return null;
    const teams = data.teams || [];
    const total = teams.length;
    const finished = teams.filter(t => t.isFinished).length;
    const running = teams.filter(t => !t.isFinished && t.currentWeek > 1).length;
    const waiting = total - finished - running;
    const costs = teams.map(t => t.totalCost || 0).filter(c => c > 0);
    const avgCost = costs.length ? costs.reduce((a, b) => a + b, 0) / costs.length : 0;
    const minCost = costs.length ? Math.min(...costs) : 0;
    const maxCost = costs.length ? Math.max(...costs) : 0;
    const fastestTeam = [...teams].sort((a, b) => b.currentWeek - a.currentWeek)[0];
    const slowestTeam = [...teams].sort((a, b) => a.currentWeek - b.currentWeek)[0];
    return { total, finished, running, waiting, avgCost, minCost, maxCost, fastestTeam, slowestTeam };
  }, [data]);

  if (error) return <div className="bg-red-900/30 border border-red-600 rounded-md p-4">{error}</div>;
  if (!data) return <div className="text-[#8a96a8]">로딩 중...</div>;

  const joinUrl = `${window.location.origin}/join/${data.code}`;

  return (
    <div className="space-y-5">
      {/* 헤더 ------------------------------------------------------- */}
      <div className="bg-[#1a2332] border border-[#2c3a52] rounded-2xl p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="text-sm text-[#8a96a8]">세션 코드</div>
            <div className="text-5xl font-bold tracking-widest text-[#f4a261]">{data.code}</div>
          </div>
          <div className="text-right text-sm">
            <div className="text-[#8a96a8]">참가 URL</div>
            <a href={joinUrl} className="text-[#f4a261] hover:underline" target="_blank" rel="noreferrer">
              {joinUrl}
            </a>
            <div className="text-[#8a96a8] mt-2">상태: <span className="text-white font-semibold">{data.status}</span></div>
          </div>
        </div>
        <div className="mt-4 flex gap-2 flex-wrap">
          {data.status === 'lobby' && (
            <button onClick={handleStart} disabled={busy}
                    className="bg-[#f4a261] text-black font-semibold px-5 py-2 rounded-md disabled:opacity-50">
              {busy ? '시작 중...' : '🎮 게임 시작'}
            </button>
          )}
          {data.status === 'running' && (
            <button onClick={handleFinish} disabled={busy}
                    className="bg-[#e76f51] text-white font-semibold px-5 py-2 rounded-md disabled:opacity-50">
              ⏹ 강제 종료
            </button>
          )}
          {(data.status === 'running' || data.status === 'finished') && (
            <a href={api.exportCsvUrl(sessionId, adminToken)}
               className="bg-[#232f44] border border-[#2c3a52] text-white font-semibold px-5 py-2 rounded-md inline-block">
              📁 CSV 내보내기
            </a>
          )}
        </div>
      </div>

      {/* 요약 통계 ------------------------------------------------- */}
      {summary && data.status !== 'lobby' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryCard label="진행 중 / 전체" value={`${summary.running + summary.waiting} / ${summary.total}`}
                       sub={`완료 ${summary.finished}`} />
          <SummaryCard label="평균 비용" value={`$${summary.avgCost.toFixed(2)}`}
                       sub={`최저 $${summary.minCost.toFixed(2)} · 최고 $${summary.maxCost.toFixed(2)}`} />
          <SummaryCard label="가장 빠른 팀"
                       value={summary.fastestTeam?.name || '—'}
                       sub={`주 ${summary.fastestTeam?.currentWeek || 0}/${data.config.weeks}`}
                       color="#2a9d8f" />
          <SummaryCard label="가장 느린 팀"
                       value={summary.slowestTeam?.name || '—'}
                       sub={`주 ${summary.slowestTeam?.currentWeek || 0}/${data.config.weeks}`}
                       color="#e76f51" />
        </div>
      )}

      {/* 비교 차트 ------------------------------------------------- */}
      {data.status !== 'lobby' && (
        <ComparisonChart teams={data.teams} adminToken={adminToken} sessionId={sessionId} />
      )}

      {/* 팀 그리드 ------------------------------------------------- */}
      <div className="bg-[#1a2332] border border-[#2c3a52] rounded-2xl p-6">
        <h2 className="text-lg font-bold mb-4 text-[#f4a261]">팀 현황 ({data.teams.length}개)</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {data.teams.map(team => (
            <TeamCard
              key={team.id}
              team={team}
              totalWeeks={data.config.weeks}
              sessionStatus={data.status}
              onClick={() => navigate(`/admin/${sessionId}/team/${team.id}`)}
              onForceAdvance={() => handleForceAdvance(team.id, team.name)}
            />
          ))}
        </div>
      </div>

      <div className="bg-[#1a2332] border border-[#2c3a52] rounded-2xl p-6 text-sm text-[#8a96a8]">
        <strong className="text-white">설정 요약:</strong>{' '}
        주차 {data.config.weeks} · 주문지연 {data.config.orderDelay} · 배송지연 {data.config.shipDelay} ·
        시작재고 {data.config.startInv} · 수요 {data.config.demand} · 정보격리 {data.config.info}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, sub, color }) {
  return (
    <div className="bg-[#1a2332] border border-[#2c3a52] rounded-xl p-4">
      <div className="text-xs text-[#8a96a8] uppercase tracking-wider">{label}</div>
      <div className="text-2xl font-bold mt-1" style={color ? { color } : {}}>{value}</div>
      {sub && <div className="text-xs text-[#8a96a8] mt-1">{sub}</div>}
    </div>
  );
}

// 팀 카드 ------------------------------------------------------------------
function TeamCard({ team, totalWeeks, sessionStatus, onClick, onForceAdvance }) {
  const submittedCount = team.submitted
    ? Object.values(team.submitted).filter(Boolean).length
    : (team.submittedCount ?? 0);
  const stuck = sessionStatus === 'running' && !team.isFinished && submittedCount < 4 && submittedCount > 0;

  return (
    <div
      onClick={onClick}
      className={`bg-[#232f44] border rounded-xl p-4 cursor-pointer hover:border-[#f4a261] transition ${
        stuck ? 'border-yellow-700/60' : 'border-[#2c3a52]'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold">{team.name}</div>
        <div className="text-xs">
          {team.isFinished
            ? <span className="bg-green-900/50 text-green-300 px-2 py-1 rounded">완료</span>
            : <span className="text-[#8a96a8]">주 {team.currentWeek}/{totalWeeks}</span>}
        </div>
      </div>
      <div className="h-1 bg-[#1a2332] rounded mb-3 overflow-hidden">
        <div className="h-full bg-[#f4a261]"
             style={{ width: `${((team.currentWeek - 1) / totalWeeks) * 100}%` }} />
      </div>
      <div className="space-y-1 text-sm">
        {ROLES.map(role => {
          const occ = team.occupants.find(o => o.role === role);
          const submitted = team.submitted?.[role];
          return (
            <div key={role} className="flex justify-between items-center">
              <span style={{ color: ROLE_COLORS[role] }}>{ROLE_LABELS[role]}</span>
              <span className="text-xs text-[#8a96a8]">
                {occ ? `${occ.name}${occ.isAi ? ' (AI)' : ''}` : '—'}
                {submitted && <span className="ml-1 text-green-400">✓</span>}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 pt-2 border-t border-[#2c3a52] flex justify-between items-center text-xs">
        <span className="text-[#8a96a8]">제출: {submittedCount}/4</span>
        <span className="text-[#f4a261] font-semibold">${(team.totalCost || 0).toFixed(2)}</span>
      </div>
      {stuck && (
        <button
          onClick={(e) => { e.stopPropagation(); onForceAdvance(); }}
          className="mt-2 w-full text-xs bg-yellow-900/40 text-yellow-200 hover:bg-yellow-900/60 py-1 rounded"
        >
          ⚡ 강제 진행 (지각자 AI로)
        </button>
      )}
    </div>
  );
}

// 비교 차트 ----------------------------------------------------------------
function ComparisonChart({ teams, adminToken, sessionId }) {
  const [histories, setHistories] = useState({});

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const map = {};
      await Promise.all(teams.map(async (t) => {
        try {
          const detail = await api.getTeamDetail(sessionId, t.id, adminToken);
          map[t.id] = detail.history;
        } catch (_) {}
      }));
      if (!cancelled) setHistories(map);
    }
    load();
    const id = setInterval(load, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, [teams.map(t => t.currentWeek + ':' + t.id).join(','), sessionId, adminToken]);

  const maxWeek = Math.max(...teams.map(t => t.currentWeek), 1);
  const labels = Array.from({ length: maxWeek - 1 }, (_, i) => `W${i + 1}`);

  const datasets = teams.map((t, i) => {
    const history = histories[t.id] || [];
    const data = labels.map((_, idx) => {
      const h = history[idx];
      if (!h) return null;
      return ROLES.reduce((s, r) => s + h.roles[r].totalCost, 0);
    });
    return {
      label: t.name,
      data,
      borderColor: TEAM_PALETTE[i % TEAM_PALETTE.length],
      backgroundColor: TEAM_PALETTE[i % TEAM_PALETTE.length] + '33',
      tension: 0.2,
      borderWidth: 2,
      pointRadius: 1,
      spanGaps: true
    };
  });

  if (labels.length === 0) {
    return (
      <div className="bg-[#1a2332] border border-[#2c3a52] rounded-2xl p-6 text-sm text-[#8a96a8]">
        팀 진행이 시작되면 비교 차트가 표시됩니다.
      </div>
    );
  }

  return (
    <div className="bg-[#1a2332] border border-[#2c3a52] rounded-2xl p-4">
      <div className="text-sm font-semibold text-[#f4a261] mb-2">팀별 누적 비용 비교</div>
      <div className="h-64">
        <Line
          data={{ labels, datasets }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { labels: { color: '#e7eaee', font: { size: 11 } }, position: 'right' }
            },
            scales: {
              x: { ticks: { color: '#8a96a8' }, grid: { color: '#2c3a52' } },
              y: { ticks: { color: '#8a96a8' }, grid: { color: '#2c3a52' } }
            }
          }}
        />
      </div>
    </div>
  );
}
