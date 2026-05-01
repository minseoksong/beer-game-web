// AI 의사결정 정책 — 4종 제공.
// 모든 정책은 (state, roleId, config) → 정수 주문량 반환.
// 강사가 세션마다 기본 정책을 선택할 수 있고, 향후 역할별 다른 정책도 가능.

import { downstreamOf } from './config.js';

// 최근 N주의 수요 (소매상은 고객 수요, 그 외는 자기 하류의 주문)
function recentDemand(state, roleId, n = 4) {
  if (roleId === 'retailer') {
    return state.customerDemandHistory.slice(-n);
  }
  return state.roles[downstreamOf(roleId)].orderHistory.slice(-n);
}

// 최근 평균 (없으면 4 가정)
function avgRecent(state, roleId, n = 4) {
  const arr = recentDemand(state, roleId, n);
  return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 4;
}

// ─────────────────────────────────────────────────────────────
// 1. base-stock (기본) — target 재고를 유지하려는 정책. 채찍효과 강함.
// target = avg * (leadTime + 2) + safetyStock
// ─────────────────────────────────────────────────────────────
function baseStock(state, roleId, config) {
  const r = state.roles[roleId];
  const avg = avgRecent(state, roleId, 4);
  const leadTime = config.orderDelay + config.shipDelay;
  const target = avg * (leadTime + 2) + 4;
  const onOrder = (r.incomingShipments || []).reduce((a, b) => a + b, 0);
  const netInv = r.inventory - r.backlog;
  return Math.max(0, Math.round(target - netInv - onOrder));
}

// ─────────────────────────────────────────────────────────────
// 2. naive — 들어온 주문을 그대로 상류에 패스스루.
// 단순하지만 정보 격리 상태에선 채찍효과 일으키지 않음 (수요 신호 그대로).
// ─────────────────────────────────────────────────────────────
function naive(state, roleId, _config) {
  const arr = recentDemand(state, roleId, 1);
  return arr.length > 0 ? Math.round(arr[arr.length - 1]) : 4;
}

// ─────────────────────────────────────────────────────────────
// 3. conservative — 평균 수요만 주문, 안전재고 정도만 유지.
// 안정적이지만 갑작스런 수요 증가에 약함.
// ─────────────────────────────────────────────────────────────
function conservative(state, roleId, config) {
  const r = state.roles[roleId];
  const avg = avgRecent(state, roleId, 8); // 더 긴 평균
  const safetyStock = config.startInv;
  const onOrder = (r.incomingShipments || []).reduce((a, b) => a + b, 0);
  const netInv = r.inventory - r.backlog;
  // 부족한 만큼 + 평균 수요만큼만
  const shortfall = Math.max(0, safetyStock - (netInv + onOrder));
  return Math.round(avg + shortfall * 0.3);
}

// ─────────────────────────────────────────────────────────────
// 4. reactive — 백오더가 있으면 과대주문, 재고 많으면 줄임.
// 단순하지만 채찍효과를 가장 크게 일으키는 "panic" 정책.
// 학생들이 피해야 할 패턴 시연용.
// ─────────────────────────────────────────────────────────────
function reactive(state, roleId, _config) {
  const r = state.roles[roleId];
  const avg = avgRecent(state, roleId, 2); // 짧은 메모리
  if (r.backlog > 0) return Math.round(avg + r.backlog * 1.5);
  if (r.inventory > avg * 4) return 0;
  return Math.round(avg);
}

// ─────────────────────────────────────────────────────────────
// 정책 레지스트리
// ─────────────────────────────────────────────────────────────
export const POLICIES = {
  base_stock:   { name: 'Base-Stock',   description: '목표 재고 유지 정책 (MIT 기본)',   fn: baseStock },
  naive:        { name: 'Naive',        description: '받은 주문을 그대로 상류에 전달',  fn: naive },
  conservative: { name: 'Conservative', description: '평균 수요 주문, 갑작스런 변화에 약함', fn: conservative },
  reactive:     { name: 'Reactive',     description: '재고/백오더에 과민반응 (panic)',   fn: reactive }
};

export const DEFAULT_POLICY = 'base_stock';

// 통합 진입점 — config.aiPolicy 값에 따라 분기. 미지정 시 base_stock.
export function aiDecide(state, roleId, config) {
  const policyKey = config.aiPolicy || DEFAULT_POLICY;
  const policy = POLICIES[policyKey] || POLICIES[DEFAULT_POLICY];
  return policy.fn(state, roleId, config);
}
