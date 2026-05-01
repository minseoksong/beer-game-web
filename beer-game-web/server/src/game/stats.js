// 통계 헬퍼 — 차트와 결과 화면에서 쓰는 요약 지표.

import { ROLE_IDS } from './config.js';

export function stddev(arr) {
  if (!arr || arr.length === 0) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((s, x) => s + (x - mean) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

// 게임 종료 후 한 팀의 요약 통계
export function summarizeTeam(state) {
  const customerStd = stddev(state.customerDemandHistory);
  const totalCost = ROLE_IDS.reduce((s, id) => s + state.roles[id].totalCost, 0);

  const perRole = {};
  let maxAmplification = 0;
  for (const id of ROLE_IDS) {
    const r = state.roles[id];
    const orderStd = stddev(r.orderHistory);
    const amp = customerStd > 0 ? orderStd / customerStd : orderStd;
    if (amp > maxAmplification) maxAmplification = amp;
    perRole[id] = {
      totalCost: r.totalCost,
      maxInventory: Math.max(0, ...r.inventoryHistory),
      maxBacklog: Math.max(0, ...r.backlogHistory),
      orderStd,
      amplification: amp
    };
  }

  return {
    weeks: state.customerDemandHistory.length,
    totalCost,
    customerDemandStd: customerStd,
    maxAmplification,
    perRole
  };
}
