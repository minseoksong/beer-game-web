import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { DEMAND_PATTERNS, AI_POLICIES, SCENARIO_PRESETS } from '../lib/gameOptions.js';

const DEFAULT_CONFIG = {
  weeks: 36, orderDelay: 2, shipDelay: 2, startInv: 12,
  holdCost: 0.5, backCost: 1.0, demand: 'step', info: 'full', aiPolicy: 'base_stock'
};

export default function Admin() {
  const navigate = useNavigate();
  const [teamCount, setTeamCount] = useState(4);
  const [config, setConfig] = useState({ ...DEFAULT_CONFIG });
  const [selectedPreset, setSelectedPreset] = useState('classic');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  function setCfg(key, val) {
    setConfig(c => ({ ...c, [key]: val }));
    setSelectedPreset(''); // 수동 변경 시 프리셋 표시 해제
  }

  function applyPreset(presetValue) {
    setSelectedPreset(presetValue);
    const preset = SCENARIO_PRESETS.find(p => p.value === presetValue);
    if (preset) setConfig({ ...preset.config });
  }

  async function handleCreate(e) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const result = await api.createSession({ teamCount, config });
      sessionStorage.setItem(`admin:${result.id}`, result.adminToken);
      navigate(`/admin/${result.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleCreate} className="space-y-6 max-w-3xl">
      <div className="bg-[#1a2332] border border-[#2c3a52] rounded-2xl p-6">
        <h2 className="text-xl font-bold mb-4 text-[#f4a261]">새 세션 만들기</h2>

        <div className="mb-6">
          <label className="block text-sm text-[#8a96a8] mb-2">팀 개수 (1~20)</label>
          <input
            type="number" min={1} max={20} required
            value={teamCount}
            onChange={e => setTeamCount(parseInt(e.target.value) || 1)}
            className="w-32 bg-[#232f44] border border-[#2c3a52] rounded-md px-3 py-2"
          />
          <span className="ml-3 text-sm text-[#8a96a8]">{teamCount}개 팀이 자동 생성됩니다 (1조 ~ {teamCount}조)</span>
        </div>

        {/* 시나리오 프리셋 */}
        <div className="mb-6">
          <label className="block text-sm text-[#8a96a8] mb-2">시나리오 프리셋</label>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
            {SCENARIO_PRESETS.map(p => (
              <button key={p.value} type="button"
                      onClick={() => applyPreset(p.value)}
                      className={`text-left p-2 rounded-md border text-xs transition ${
                        selectedPreset === p.value
                          ? 'border-[#f4a261] bg-[#232f44]'
                          : 'border-[#2c3a52] bg-[#1a2332] hover:border-[#f4a261]'
                      }`}>
                <div className="font-semibold">{p.label}</div>
              </button>
            ))}
          </div>
          <p className="text-xs text-[#8a96a8] mt-2">아래 옵션을 직접 조정하면 프리셋이 해제됩니다.</p>
        </div>

        <h3 className="font-semibold mb-3 text-[#f4a261]">게임 규칙</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="전체 주차" value={config.weeks}
                 onChange={v => setCfg('weeks', parseInt(v) || 1)} type="number" min={10} max={100}/>
          <Field label="주문 지연 (주)" value={config.orderDelay}
                 onChange={v => setCfg('orderDelay', parseInt(v) || 0)} type="number" min={0} max={5}/>
          <Field label="배송 지연 (주)" value={config.shipDelay}
                 onChange={v => setCfg('shipDelay', parseInt(v) || 0)} type="number" min={0} max={5}/>
          <Field label="시작 재고" value={config.startInv}
                 onChange={v => setCfg('startInv', parseInt(v) || 0)} type="number" min={0} max={50}/>
          <Field label="재고 보유비용 ($/단위/주)" value={config.holdCost}
                 onChange={v => setCfg('holdCost', parseFloat(v) || 0)} type="number" step="0.1"/>
          <Field label="백오더 비용 ($/단위/주)" value={config.backCost}
                 onChange={v => setCfg('backCost', parseFloat(v) || 0)} type="number" step="0.1"/>

          <div>
            <label className="block text-sm text-[#8a96a8] mb-1">고객 수요 패턴</label>
            <select value={config.demand} onChange={e => setCfg('demand', e.target.value)}
                    className="w-full bg-[#232f44] border border-[#2c3a52] rounded-md px-3 py-2">
              {DEMAND_PATTERNS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-[#8a96a8] mb-1">정보 격리 모드</label>
            <select value={config.info} onChange={e => setCfg('info', e.target.value)}
                    className="w-full bg-[#232f44] border border-[#2c3a52] rounded-md px-3 py-2">
              <option value="full">완전 (인접 단계만 — MIT 정통)</option>
              <option value="partial">부분 (자기 단계만)</option>
              <option value="open">개방 (모든 정보 공개)</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm text-[#8a96a8] mb-1">AI 정책 (빈 자리 채울 AI의 의사결정 방식)</label>
            <select value={config.aiPolicy} onChange={e => setCfg('aiPolicy', e.target.value)}
                    className="w-full bg-[#232f44] border border-[#2c3a52] rounded-md px-3 py-2">
              {AI_POLICIES.map(p => (
                <option key={p.value} value={p.value}>{p.label} — {p.description}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-600 rounded-md p-3 text-sm">{error}</div>
      )}

      <button type="submit" disabled={busy}
              className="bg-[#f4a261] text-black font-semibold px-6 py-3 rounded-md disabled:opacity-50">
        {busy ? '생성 중...' : '세션 만들기 →'}
      </button>
    </form>
  );
}

function Field({ label, value, onChange, ...rest }) {
  return (
    <div>
      <label className="block text-sm text-[#8a96a8] mb-1">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)}
             className="w-full bg-[#232f44] border border-[#2c3a52] rounded-md px-3 py-2"
             {...rest}/>
    </div>
  );
}
