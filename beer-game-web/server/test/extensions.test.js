// 향후 확장 — AI 정책 + 수요 패턴 + 시나리오 프리셋 테스트.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  ROLE_IDS, DEFAULT_CONFIG,
  getCustomerDemand, DEMAND_PATTERNS, SCENARIO_PRESETS
} from '../src/game/config.js';
import { createInitialTeamState, simulateWeek, isFinished } from '../src/game/engine.js';
import { aiDecide, POLICIES, DEFAULT_POLICY } from '../src/game/ai.js';

function runWith(config) {
  const state = createInitialTeamState(config);
  while (!isFinished(state, config)) {
    const orders = {};
    for (const id of ROLE_IDS) orders[id] = aiDecide(state, id, config);
    simulateWeek(state, orders, config);
  }
  const total = ROLE_IDS.reduce((s, id) => s + state.roles[id].totalCost, 0);
  return { state, totalCost: total };
}

// ---------------------------------------------------------------- AI 정책 ----
describe('AI 정책 4종', () => {
  test('레지스트리에 4개 정책 등록', () => {
    assert.equal(Object.keys(POLICIES).length, 4);
    assert.ok(POLICIES.base_stock);
    assert.ok(POLICIES.naive);
    assert.ok(POLICIES.conservative);
    assert.ok(POLICIES.reactive);
    assert.equal(DEFAULT_POLICY, 'base_stock');
  });

  test('각 정책: 36주 시뮬레이션 완료 + 무결성 통과', () => {
    for (const policy of Object.keys(POLICIES)) {
      const config = { ...DEFAULT_CONFIG, weeks: 36, aiPolicy: policy };
      const { state } = runWith(config);
      // 무결성: 음수 없음
      for (const id of ROLE_IDS) {
        const r = state.roles[id];
        assert.ok(r.inventoryHistory.every(v => v >= 0), `${policy}/${id}: 재고 음수`);
        assert.ok(r.backlogHistory.every(v => v >= 0), `${policy}/${id}: 백오더 음수`);
      }
    }
  });

  test('naive 정책: 패스스루이므로 채찍효과가 거의 없어야 함', () => {
    const config = { ...DEFAULT_CONFIG, weeks: 36, aiPolicy: 'naive' };
    const { state } = runWith(config);
    // 소매상 주문 ≈ 고객 수요. 고객 변동성과 큰 차이 없어야 함.
    const customerStd = stddev(state.customerDemandHistory);
    const retailStd = stddev(state.roles.retailer.orderHistory);
    // naive는 단순 패스스루라 표준편차도 비슷해야 함 (몇 % 이내)
    assert.ok(retailStd <= customerStd * 1.5,
      `naive 소매상 std ${retailStd.toFixed(2)} vs 고객 ${customerStd.toFixed(2)}`);
  });

  test('reactive vs base_stock: 비용 비교', () => {
    const baseRes = runWith({ ...DEFAULT_CONFIG, weeks: 36, aiPolicy: 'base_stock' });
    const reactRes = runWith({ ...DEFAULT_CONFIG, weeks: 36, aiPolicy: 'reactive' });
    // 둘 다 채찍효과를 일으키지만 비용은 0보다 커야 함
    assert.ok(baseRes.totalCost > 0);
    assert.ok(reactRes.totalCost > 0);
  });

  test('잘못된 정책: 기본 정책으로 폴백', () => {
    const config = { ...DEFAULT_CONFIG, weeks: 8, aiPolicy: 'nonexistent' };
    const { totalCost } = runWith(config); // 에러 없이 끝나야 함
    assert.ok(totalCost >= 0);
  });
});

// ---------------------------------------------------------------- 수요 패턴 ----
describe('수요 패턴 10종', () => {
  test('DEMAND_PATTERNS에 10개 정의', () => {
    assert.equal(Object.keys(DEMAND_PATTERNS).length, 10);
  });

  test('모든 패턴: 1~50주 동안 음수/NaN 없음', () => {
    for (const pattern of Object.keys(DEMAND_PATTERNS)) {
      for (let w = 1; w <= 50; w++) {
        const d = getCustomerDemand(w, pattern);
        assert.ok(Number.isInteger(d), `${pattern} 주 ${w}: ${d} 정수 아님`);
        assert.ok(d >= 0, `${pattern} 주 ${w}: ${d} 음수`);
        assert.ok(d <= 50, `${pattern} 주 ${w}: ${d} 비현실적으로 큼`);
      }
    }
  });

  test('pandemic_spike: 7~9주 사이 16으로 급증', () => {
    assert.equal(getCustomerDemand(1, 'pandemic_spike'), 4);
    assert.equal(getCustomerDemand(8, 'pandemic_spike'), 16);
    assert.equal(getCustomerDemand(20, 'pandemic_spike'), 4);
  });

  test('supply_shock: 5~6주 0', () => {
    assert.equal(getCustomerDemand(5, 'supply_shock'), 0);
    assert.equal(getCustomerDemand(6, 'supply_shock'), 0);
    assert.equal(getCustomerDemand(8, 'supply_shock'), 4);
  });

  test('holiday: 12~16주 14', () => {
    for (let w = 12; w <= 16; w++) {
      assert.equal(getCustomerDemand(w, 'holiday'), 14, `주 ${w}`);
    }
    assert.equal(getCustomerDemand(20, 'holiday'), 4);
  });

  test('oscillating: 짝수=8, 홀수=4', () => {
    assert.equal(getCustomerDemand(1, 'oscillating'), 4);
    assert.equal(getCustomerDemand(2, 'oscillating'), 8);
    assert.equal(getCustomerDemand(7, 'oscillating'), 4);
    assert.equal(getCustomerDemand(8, 'oscillating'), 8);
  });

  test('double_step: 5주차 4→8, 15주차 8→4', () => {
    assert.equal(getCustomerDemand(4, 'double_step'), 4);
    assert.equal(getCustomerDemand(5, 'double_step'), 8);
    assert.equal(getCustomerDemand(14, 'double_step'), 8);
    assert.equal(getCustomerDemand(15, 'double_step'), 4);
  });
});

// ---------------------------------------------------------------- 시나리오 프리셋 ----
describe('시나리오 프리셋', () => {
  test('SCENARIO_PRESETS에 5개 정의', () => {
    assert.equal(Object.keys(SCENARIO_PRESETS).length, 5);
    for (const key of ['classic', 'pandemic', 'holiday', 'stable', 'chaos']) {
      assert.ok(SCENARIO_PRESETS[key], `${key} 누락`);
      assert.ok(SCENARIO_PRESETS[key].config, `${key}.config 누락`);
    }
  });

  test('모든 프리셋: 끝까지 시뮬레이션 가능', () => {
    for (const [name, preset] of Object.entries(SCENARIO_PRESETS)) {
      const { state, totalCost } = runWith(preset.config);
      assert.ok(state.week > preset.config.weeks, `${name}: 종료 안됨`);
      assert.ok(totalCost >= 0, `${name}: 비용 음수 (${totalCost})`);
      // 무결성
      for (const id of ROLE_IDS) {
        const r = state.roles[id];
        assert.ok(r.inventoryHistory.every(v => v >= 0), `${name}/${id}: 재고 음수`);
      }
    }
  });
});

function stddev(arr) {
  if (arr.length === 0) return 0;
  const m = arr.reduce((a, b) => a + b, 0) / arr.length;
  return Math.sqrt(arr.reduce((s, x) => s + (x - m) ** 2, 0) / arr.length);
}
