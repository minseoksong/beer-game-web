import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { connectAsPlayer } from '../lib/socket.js';

const ROLE_LABELS = {
  retailer: '소매상', wholesaler: '도매상', distributor: '유통업자', factory: '공장'
};

export default function Lobby() {
  const navigate = useNavigate();
  const [me, setMe] = useState(null);
  const [session, setSession] = useState(null);
  const [team, setTeam] = useState(null);
  const [teammates, setTeammates] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('player_token');
    if (!token) { navigate('/join'); return; }

    const socket = connectAsPlayer(token);

    socket.on('connect_error', (err) => setError('연결 실패: ' + err.message));

    socket.on('state:full', (data) => {
      setMe(data.me);
      setSession(data.session);
      setTeam(data.team);
      setTeammates(data.teammates);
      // 게임이 이미 진행 중이면 Play로
      if (data.session.status === 'running' && !data.team.isFinished) {
        navigate('/play');
      } else if (data.team.isFinished || data.session.status === 'finished') {
        navigate('/results');
      }
    });

    socket.on('game:started', () => navigate('/play'));

    socket.on('game:finished', () => navigate('/results'));

    return () => socket.disconnect();
  }, [navigate]);

  function leave() {
    localStorage.removeItem('player_token');
    localStorage.removeItem('player_session');
    navigate('/');
  }

  if (error) return <div className="bg-red-900/30 border border-red-600 rounded-md p-4">{error}</div>;
  if (!me || !session || !team) return <div className="text-[#8a96a8]">연결 중...</div>;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="bg-[#1a2332] border border-[#2c3a52] rounded-2xl p-6">
        <div className="text-sm text-[#8a96a8]">합류 완료</div>
        <div className="text-2xl font-bold mt-1">
          {team.name} — <span className="text-[#f4a261]">{ROLE_LABELS[me.role]}</span>
        </div>
        <div className="text-sm text-[#8a96a8] mt-1">{me.name}</div>
      </div>

      <div className="bg-[#1a2332] border border-[#2c3a52] rounded-2xl p-6">
        <h3 className="font-bold mb-3 text-[#f4a261]">우리 팀 멤버</h3>
        <div className="space-y-2">
          {['retailer', 'wholesaler', 'distributor', 'factory'].map(role => {
            const occ = teammates.find(o => o.role === role);
            const isMe = role === me.role;
            return (
              <div key={role}
                   className={`flex justify-between items-center p-3 rounded-md ${isMe ? 'bg-[#232f44] border border-[#f4a261]' : 'bg-[#232f44]'}`}>
                <div>
                  <div className="font-semibold">{ROLE_LABELS[role]}</div>
                  <div className="text-xs text-[#8a96a8]">
                    {occ ? `${occ.name}${occ.isAi ? ' (AI)' : ''}${isMe ? ' (나)' : ''}` : '— 대기 중 —'}
                  </div>
                </div>
                <div className={`text-xs px-2 py-1 rounded ${occ ? 'bg-green-900/40 text-green-300' : 'bg-[#2c3a52] text-[#8a96a8]'}`}>
                  {occ ? '입장' : '대기'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-yellow-900/20 border border-yellow-700/40 rounded-md p-4 text-sm">
        ⏳ 관리자가 <strong>"게임 시작"</strong>을 누르면 자동으로 게임 화면으로 이동합니다.
        빈 자리는 자동으로 AI가 채워집니다.
      </div>

      <button onClick={leave}
              className="text-sm text-[#8a96a8] hover:text-white underline">
        세션 나가기
      </button>
    </div>
  );
}
