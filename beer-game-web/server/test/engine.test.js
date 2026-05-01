// Node 내장 테스트 러너 (`node --test`) — 외부 의존성 없음.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  ROLES, ROLE_IDS, DEFAULT_CONFIG,
  downstreamOf, upstreamOf, getCustomerDemand
} from '../src/game/config.js';
import { createInitialTeamState, simulateWeek, isFinished } from '../src/game/engine.js';
import { aiDecide } from '../src/game/ai.js';
import { stddev, summarizeTeam } from '../src/game/stats.js';

// ---------------------------------------------------------------- helpers ----
function runAllAi(weeks = 36, configOverrides = {}) {
  const config = { ...DEFAULT_CONFIG, weeks, ...configOverrides };
  const state = createInitialTeamState(config);
  const snapshots = [];
  while (!isFinished(state, config)) {
    const orders = {};
    for (const id of ROLE_IDS) orders[id] = aiDecide(state, id, config);
    snapshots.push(simulateWeek(state, orders, config));
  }
  return { state, config, snapshots };
}

// ---------------------------------------------------------------- config ----
describe('config', () => {
  test('역할 4개', () => {
    assert.equal(ROLES.length, 4);
    assert.deepEqual(ROLE_IDS, ['retailer', 'wholesaler', 'distributor', 'factory']);
  });

  test('인접 관계', () => {
    assert.equal(downstreamOf('retailer'), null);
    assert.equal(downstreamOf('wholesaler'), 'retailer');
    assert.equal(upstreamOf('retailer'), 'wholesaler');
    assert.equal(upstreamOf('factory'), null);
  });

  test('수요 패턴: step', () => {
    assert.equal(getCustomerDemand(1, 'step'), 4);
    assert.equal(getCustomerDemand(4, 'step'), 4);
    assert.equal(getCustomerDemand(5, 'step'), 8);
    assert.equal(getCustomerDemand(36, 'step'), 8);
  });

  test('수요 패턴: constant', () => {
    for (let w = 1; w <= 50; w++) {
      assert.equal(getCustomerDemand(w, 'constant'), 4);
    }
  });

  test('수요 패턴: random은 시드 RNG로 결정적', () => {
    const fakeRng = () => 0.5;  // floor(0.5 * 5) + 3 = 5
    assert.equal(getCustomerDemand(1, 'random', fakeRng), 5);
    assert.equal(getCustomerDemand(50, 'random', fakeRng), 5);
  });

  test('수요 패턴: growing 단조 증가, 12에서 cap', () => {
    let prev = 0;
    for (let w = 1; w <= 50; w++) {
      const d = getCustomerDemand(w, 'growing');
      assert.ok(d >= prev, `주 ${w}: ${d} < 이전 ${prev}`);
      assert.ok(d <= 12);
      prev = d;
    }
  });
});

// ---------------------------------------------------------------- engine ----
describe('engine — 초기 상태', () => {
  test('createInitialTeamState 4역할 모두 시작 재고/큐 채움', () => {
    const config = { ...DEFAULT_CONFIG };
    const state = createInitialTeamState(config);
    assert.equal(state.week, 1);
    assert.deepEqual(state.customerDemandHistory, []);
    for (const id of ROLE_IDS) {
      const r = state.roles[id];
      assert.equal(r.inventory, config.startInv);
      assert.equal(r.backlog, 0);
      assert.equal(r.totalCost, 0);
      assert.equal(r.incomingShipments.length, config.shipDelay);
      assert.equal(r.incomingOrders.length, config.orderDelay);
    }
  });
});

describe('engine — 한 주 진행', () => {
  test('정상 주문은 큐에 잘 들어감', () => {
    const config = { ...DEFAULT_CONFIG };
    const state = createInitialTeamState(config);
    const orders = { retailer: 4, wholesaler: 4, distributor: 4, factory: 4 };
    const snap = simulateWeek(state, orders, config);
    assert.equal(state.week, 2);
    assert.equal(state.customerDemandHistory.length, 1);
    assert.equal(snap.week, 1);
    // 첫 주는 균형 상태이므로 재고 변동 없음
    for (const id of ROLE_IDS) {
      const r = state.roles[id];
      assert.equal(r.inventory, config.startInv);
      assert.equal(r.backlog, 0);
    }
  });

  test('재고가 수요보다 적으면 백오더 발생', () => {
    const config = { ...DEFAULT_CONFIG, startInv: 0 };
    const state = createInitialTeamState(config);
    // shipDelay 2 만큼 4단위씩 들어옴
    state.roles.retailer.incomingShipments = [0, 0]; // 입고 없음으로 강제
    const orders = { retailer: 0, wholesaler: 0, distributor: 0, factory: 0 };
    simulateWeek(state, orders, config);
    // 고객 수요 4, 재고 0 → 백오더 4
    assert.equal(state.roles.retailer.backlog, 4);
    assert.equal(state.roles.retailer.inventory, 0);
  });

  test('잘못된 주문량은 에러', () => {
    const config = { ...DEFAULT_CONFIG };
    const state = createInitialTeamState(config);
    assert.throws(() => simulateWeek(state, { retailer: -1, wholesaler: 0, distributor: 0, factory: 0 }, config));
    assert.throws(() => simulateWeek(state, { retailer: 'x', wholesaler: 0, distributor: 0, factory: 0 }, config));
  });
});

// ----------------------------------------------------------- 무결성 ----
describe('engine — 무결성', () => {
  test('36주 AI 시뮬레이션 — 모든 불변식 통과', () => {
    const { state } = runAllAi(36);
    for (const id of ROLE_IDS) {
      const r = state.roles[id];
      // 재고/백오더는 음수 불가
      r.inventoryHistory.forEach((v, i) => assert.ok(v >= 0, `${id} 주 ${i+1}: 재고 ${v}`));
      r.backlogHistory.forEach((v, i) => assert.ok(v >= 0, `${id} 주 ${i+1}: 백오더 ${v}`));
      // 비용은 단조 증가
      for (let i = 1; i < r.costHistory.length; i++) {
        assert.ok(r.costHistory[i] >= r.costHistory[i-1] - 1e-9,
          `${id} 주 ${i+1}: 비용 감소 ${r.costHistory[i-1]} -> ${r.costHistory[i]}`);
      }
      // 재고 > 0 이면 백오더는 0이어야 함 (동시 양수 불가)
      r.inventoryHistory.forEach((inv, i) => {
        if (inv > 0) assert.equal(r.backlogHistory[i], 0,
          `${id} 주 ${i+1}: 재고=${inv}, 백오더=${r.backlogHistory[i]}`);
      });
    }
  });

  test('큐 길이는 안정적으로 유지됨 (오실레이션 없이)', () => {
    // 처리 순서가 retailer→factory이므로, 한 주 끝에 incomingShipments는
    // shipDelay 또는 shipDelay+1 (상류가 같은 주에 ship한 경우). factory는
    // 자기 자신에 production push 후 shipDelay. 큐가 무한 증가하지 않는 게 핵심.
    const { state, config } = runAllAi(36);
    for (const id of ROLE_IDS) {
      const r = state.roles[id];
      assert.ok(r.incomingShipments.length <= config.shipDelay + 1,
        `${id}: incomingShipments 너무 김 (${r.incomingShipments.length})`);
      if (id !== 'retailer') {
        assert.ok(r.incomingOrders.length <= config.orderDelay + 1,
          `${id}: incomingOrders 너무 김 (${r.incomingOrders.length})`);
      }
    }
  });
});

// ---------------------------------------------------- AI 정책 회귀 ----
describe('AI 정책', () => {
  test('초기 상태에서 base-stock 의사결정', () => {
    const config = { ...DEFAULT_CONFIG };
    const state = createInitialTeamState(config);
    // recentDemand 비어있을 때 avgDemand=4 가정
    // target = 4 * (4+2) + 4 = 28
    // onOrder = 4+4 = 8
    // netInv = 12 - 0 = 12
    // order = max(0, round(28 - 12 - 8)) = 8
    const order = aiDecide(state, 'retailer', config);
    assert.equal(order, 8);
  });

  test('재고가 풍부하면 0 주문', () => {
    const config = { ...DEFAULT_CONFIG };
    const state = createInitialTeamState(config);
    state.roles.factory.inventory = 1000;
    state.roles.factory.incomingShipments = [0, 0];
    const order = aiDecide(state, 'factory', config);
    assert.equal(order, 0);
  });
});

// ---------------------------------------------------- stats ----
describe('stats', () => {
  test('stddev', () => {
    assert.equal(stddev([]), 0);
    assert.equal(stddev([5]), 0);
    assert.ok(Math.abs(stddev([1, 2, 3, 4, 5]) - Math.sqrt(2)) < 1e-9);
  });

  test('summarizeTeam — 채찍효과 측정', () => {
    const { state } = runAllAi(36);
    const summary = summarizeTeam(state);
    assert.equal(summary.weeks, 36);
    // step 수요는 변동성이 작지만 0은 아님
    assert.ok(summary.customerDemandStd > 0);
    // 채찍효과는 1배 이상 (그렇지 않으면 뭔가 잘못됨)
    assert.ok(summary.maxAmplification > 1);
    for (const id of ROLE_IDS) {
      assert.ok(summary.perRole[id].totalCost >= 0);
    }
  });
});
