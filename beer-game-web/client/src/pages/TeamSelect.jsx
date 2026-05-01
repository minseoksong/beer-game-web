import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';

const ROLES = [
  { id: 'retailer', label: '소매상', color: 'border-[#e76f51]' },
  { id: 'wholesaler', label: '도매상', color: 'border-[#f4a261]' },
  { id: 'distributor', label: '유통업자', color: 'border-[#e9c46a]' },
  { id: 'factory', label: '공장', color: 'border-[#2a9d8f]' }
];

export default function TeamSelect() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [error, setError] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [selectedRole, setSelectedRole] = useState(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      const s = await api.getSessionByCode(code);
      setSession(s);
      setError(null);
    } catch (err) { setError(err.message); }
  }

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 3000);
    return () => clearInterval(id);
  }, [code]);

  async function handleJoin(e) {
    e.preventDefault();
    if (!selectedTeam || !selectedRole || !name.trim()) return;
    setBusy(true); setError(null);
    try {
      const result = await api.joinTeam(selectedTeam.id, { role: selectedRole, name: name.trim() });
      // 토큰을 localStorage에 저장 (재접속용)
      localStorage.setItem('player_token', result.playerToken);
      localStorage.setItem('player_session', JSON.stringify({
        teamId: result.teamId,
        teamName: result.teamName,
        role: result.role,
        sessionCode: result.sessionCode
      }));
      navigate('/lobby');
    } catch (err) {
      setError(err.message);
      refresh(); // 다른 사람이 자리를 먼저 차지했을 수 있음
    } finally {
      setBusy(false);
    }
  }

  if (error && !session) return <div className="bg-red-900/30 border border-red-600 rounded-md p-4">{error}</div>;
  if (!session) return <div className="text-[#8a96a8]">로딩 중...</div>;

  return (
    <div className="space-y-6">
      <div className="bg-[#1a2332] border border-[#2c3a52] rounded-2xl p-6">
        <div className="text-sm text-[#8a96a8]">세션 코드</div>
        <div className="text-3xl font-bold tracking-widest text-[#f4a261]">{session.code}</div>
        <div className="text-sm text-[#8a96a8] mt-2">상태: {session.status} · 팀 {session.teams.length}개</div>
      </div>

      <div className="bg-[#1a2332] border border-[#2c3a52] rounded-2xl p-6">
        <h3 className="font-bold mb-3 text-[#f4a261]">1단계 — 팀 선택</h3>
        <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-3">
          {session.teams.map(team => {
            const occupied = team.occupants.length;
            const isSelected = selectedTeam?.id === team.id;
            const full = occupied >= 4;
            return (
              <button key={team.id} type="button"
                onClick={() => { setSelectedTeam(team); setSelectedRole(null); }}
                disabled={full}
                className={`text-left p-3 rounded-md border ${isSelected ? 'border-[#f4a261] bg-[#232f44]' : 'border-[#2c3a52] bg-[#1a2332]'} ${full ? 'opacity-40 cursor-not-allowed' : 'hover:border-[#f4a261]'}`}>
                <div className="font-semibold">{team.name}</div>
                <div className="text-xs text-[#8a96a8]">{occupied}/4 합류</div>
              </button>
            );
          })}
        </div>
      </div>

      {selectedTeam && (
        <div className="bg-[#1a2332] border border-[#2c3a52] rounded-2xl p-6">
          <h3 className="font-bold mb-3 text-[#f4a261]">2단계 — 역할 선택 ({selectedTeam.name})</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {ROLES.map(r => {
              const occ = selectedTeam.occupants.find(o => o.role === r.id);
              const taken = !!occ && !occ.isAi;
              const isSelected = selectedRole === r.id;
              return (
                <button key={r.id} type="button"
                  onClick={() => !taken && setSelectedRole(r.id)}
                  disabled={taken}
                  className={`p-4 rounded-md border-2 text-left ${r.color} ${isSelected ? 'bg-[#232f44]' : 'bg-[#1a2332]'} ${taken ? 'opacity-40 cursor-not-allowed' : 'hover:bg-[#232f44]'}`}>
                  <div className="font-semibold">{r.label}</div>
                  <div className="text-xs text-[#8a96a8] mt-1">
                    {occ ? `${occ.name}${occ.isAi ? ' (AI)' : ''}` : '— 빈 자리 —'}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {selectedTeam && selectedRole && (
        <form onSubmit={handleJoin} className="bg-[#1a2332] border border-[#2c3a52] rounded-2xl p-6 space-y-3">
          <h3 className="font-bold text-[#f4a261]">3단계 — 이름 입력</h3>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="홍길동"
            maxLength={30}
            required
            className="w-full bg-[#232f44] border border-[#2c3a52] rounded-md px-4 py-3"
          />
          {error && <div className="bg-red-900/30 border border-red-600 rounded-md p-3 text-sm">{error}</div>}
          <button type="submit" disabled={busy || !name.trim()}
                  className="bg-[#f4a261] text-black font-semibold px-6 py-3 rounded-md disabled:opacity-50">
            {busy ? '합류 중...' : '합류하기 →'}
          </button>
        </form>
      )}
    </div>
  );
}
