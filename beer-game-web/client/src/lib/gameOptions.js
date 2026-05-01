// 클라이언트가 직접 참조하는 게임 옵션 메타데이터.
// 서버의 config.js와 ai.js에 정의된 값과 동기화 유지 필요.

export const DEMAND_PATTERNS = [
  { value: 'step',           label: '계단형 (4→8, MIT 클래식)' },
  { value: 'constant',       label: '일정 (계속 4)' },
  { value: 'random',         label: '랜덤 (3~7)' },
  { value: 'growing',        label: '점진적 증가 (3→12)' },
  { value: 'seasonal',       label: '계절성 (사인파)' },
  { value: 'pandemic_spike', label: '팬데믹 급증 (4→16→4)' },
  { value: 'supply_shock',   label: '공급 충격 (5주에 0으로)' },
  { value: 'holiday',        label: '연말 성수기 (12~16주 14단위)' },
  { value: 'oscillating',    label: '진동 (4↔8)' },
  { value: 'double_step',    label: '이중 계단 (4→8→4)' }
];

export const AI_POLICIES = [
  { value: 'base_stock',   label: 'Base-Stock (MIT 기본)',     description: '목표 재고 유지 — 채찍효과 강함' },
  { value: 'naive',        label: 'Naive (패스스루)',           description: '받은 주문 그대로 전달' },
  { value: 'conservative', label: 'Conservative (보수적)',      description: '평균 수요 기반 안정적 주문' },
  { value: 'reactive',     label: 'Reactive (panic, 시연용)',   description: '백오더에 과민반응 — 채찍효과 극대화' }
];

export const SCENARIO_PRESETS = [
  { value: 'classic',  label: 'MIT 클래식',
    config: { weeks: 36, orderDelay: 2, shipDelay: 2, startInv: 12, holdCost: 0.5, backCost: 1.0, demand: 'step', info: 'full', aiPolicy: 'base_stock' } },
  { value: 'pandemic', label: '팬데믹 — 채찍효과 극대화',
    config: { weeks: 24, orderDelay: 2, shipDelay: 2, startInv: 12, holdCost: 0.5, backCost: 2.0, demand: 'pandemic_spike', info: 'full', aiPolicy: 'base_stock' } },
  { value: 'holiday',  label: '연말 성수기',
    config: { weeks: 24, orderDelay: 1, shipDelay: 2, startInv: 12, holdCost: 0.3, backCost: 2.0, demand: 'holiday', info: 'full', aiPolicy: 'base_stock' } },
  { value: 'stable',   label: '안정 환경 (초보용)',
    config: { weeks: 20, orderDelay: 1, shipDelay: 1, startInv: 8, holdCost: 0.5, backCost: 1.0, demand: 'constant', info: 'open', aiPolicy: 'conservative' } },
  { value: 'chaos',    label: '카오스 (가장 어려움)',
    config: { weeks: 40, orderDelay: 3, shipDelay: 3, startInv: 12, holdCost: 0.5, backCost: 1.5, demand: 'random', info: 'partial', aiPolicy: 'reactive' } }
];
