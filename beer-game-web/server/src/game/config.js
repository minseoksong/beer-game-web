// 게임 상수 및 기본값. 단일 HTML 버전(beer_game.html)과 1:1 일치.

export const ROLES = [
  { id: 'retailer',    name: '소매상',     en: 'Retailer',    color: '#e76f51' },
  { id: 'wholesaler',  name: '도매상',     en: 'Wholesaler',  color: '#f4a261' },
  { id: 'distributor', name: '유통업자',   en: 'Distributor', color: '#e9c46a' },
  { id: 'factory',     name: '공장',       en: 'Factory',     color: '#2a9d8f' }
];

export const ROLE_IDS = ROLES.map(r => r.id);

export const DEFAULT_CONFIG = {
  weeks: 36,
  orderDelay: 2,
  shipDelay: 2,
  startInv: 12,
  holdCost: 0.5,
  backCost: 1.0,
  demand: 'step',           // 수요 패턴 — DEMAND_PATTERNS 참고
  info: 'partial',          // 'full' | 'partial' | 'open' — 기본값: 내 단계만(타 플레이어 주문 비노출)
  aiPolicy: 'base_stock'    // 'base_stock' | 'naive' | 'conservative' | 'reactive'
};

// 공급사슬 인접 관계 헬퍼
export function downstreamOf(roleId) {
  const idx = ROLE_IDS.indexOf(roleId);
  if (idx <= 0) return null;        // 소매상의 하류는 고객 (역할 없음)
  return ROLE_IDS[idx - 1];
}

export function upstreamOf(roleId) {
  const idx = ROLE_IDS.indexOf(roleId);
  if (idx < 0 || idx === ROLE_IDS.length - 1) return null; // 공장의 상류는 자기 자신(생산)
  return ROLE_IDS[idx + 1];
}

// 수요 패턴 메타데이터 — UI 옵션 생성용
export const DEMAND_PATTERNS = {
  step:           { name: '계단형 (4→8, MIT 클래식)', description: '5주차에 수요 2배 증가' },
  constant:       { name: '일정 수요',                description: '항상 4 단위' },
  random:         { name: '랜덤 (3~7)',              description: '매주 3~7 사이 무작위' },
  growing:        { name: '점진적 증가',             description: '3에서 12까지 점차 증가' },
  seasonal:       { name: '계절성 (사인파)',         description: '주기적으로 오르내림' },
  pandemic_spike: { name: '팬데믹 급증',             description: '평소 4 → 8주차 16으로 급증 → 16주차 4로 복귀' },
  supply_shock:   { name: '공급 충격',               description: '5주차에 0으로 폭락 후 회복' },
  holiday:        { name: '연말 성수기',             description: '주차 중반에 큰 스파이크' },
  oscillating:    { name: '진동 수요',               description: '4와 8 사이 주차마다 진동' },
  double_step:    { name: '이중 계단형',             description: '5주차 4→8, 15주차 8→4로 복귀' }
};

// 고객 수요 계산. RNG 주입으로 random 패턴 결정론적 테스트 가능.
export function getCustomerDemand(week, demandType, rng = Math.random) {
  switch (demandType) {
    case 'step':      return week <= 4 ? 4 : 8;
    case 'constant':  return 4;
    case 'random':    return Math.floor(rng() * 5) + 3;
    case 'growing':   return Math.min(12, 3 + Math.floor((week - 1) / 3));
    case 'seasonal': {
      const base = 6, amp = 3;
      return Math.max(0, Math.round(base + amp * Math.sin((week / 8) * Math.PI)));
    }
    case 'pandemic_spike': {
      // 평소 4 → 7~9주 사이 급증 → 16주 이후 복귀
      if (week < 7) return 4;
      if (week < 10) return 16;
      if (week < 14) return 12;
      if (week < 18) return 8;
      return 4;
    }
    case 'supply_shock': {
      // 5주차에 갑자기 0 → 점진적 회복
      if (week === 5 || week === 6) return 0;
      if (week === 7) return 2;
      if (week === 8) return 4;
      return 6;
    }
    case 'holiday': {
      // 12~16주에 성수기
      if (week >= 12 && week <= 16) return 14;
      if (week === 11 || week === 17) return 8;
      return 4;
    }
    case 'oscillating':
      return week % 2 === 0 ? 8 : 4;
    case 'double_step':
      if (week <= 4) return 4;
      if (week <= 14) return 8;
      return 4;
    default: return 4;
  }
}

// 시나리오 프리셋 — 한 번에 여러 config 값을 세팅
export const SCENARIO_PRESETS = {
  classic: {
    name: 'MIT 클래식', description: '원전 비어 게임 — 계단형 수요 + 표준 지연',
    config: { weeks: 36, orderDelay: 2, shipDelay: 2, startInv: 12,
              holdCost: 0.5, backCost: 1.0, demand: 'step', info: 'partial', aiPolicy: 'base_stock' }
  },
  pandemic: {
    name: '팬데믹', description: '갑작스런 수요 폭증과 회복 — 채찍효과 극대화',
    config: { weeks: 24, orderDelay: 2, shipDelay: 2, startInv: 12,
              holdCost: 0.5, backCost: 2.0, demand: 'pandemic_spike', info: 'partial', aiPolicy: 'base_stock' }
  },
  holiday: {
    name: '연말 성수기', description: '단기 성수기 대응 시뮬레이션',
    config: { weeks: 24, orderDelay: 1, shipDelay: 2, startInv: 12,
              holdCost: 0.3, backCost: 2.0, demand: 'holiday', info: 'partial', aiPolicy: 'base_stock' }
  },
  stable: {
    name: '안정 환경', description: '단순 환경 — 초보 학생용',
    config: { weeks: 20, orderDelay: 1, shipDelay: 1, startInv: 8,
              holdCost: 0.5, backCost: 1.0, demand: 'constant', info: 'partial', aiPolicy: 'conservative' }
  },
  chaos: {
    name: '카오스', description: '랜덤 수요 + 긴 지연 + reactive AI — 가장 어려움',
    config: { weeks: 40, orderDelay: 3, shipDelay: 3, startInv: 12,
              holdCost: 0.5, backCost: 1.5, demand: 'random', info: 'partial', aiPolicy: 'reactive' }
  }
};
