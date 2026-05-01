// 회귀 테스트 — 단일 HTML 버전(beer_game.html)에 내장된 시뮬레이션 로직과
// 1:1 동일한 결과가 나오는지 확인.
// 기준값은 outputs/test_sim.js를 실행해서 얻은 값(36주, MIT 클래식, 모두 AI).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { ROLE_IDS, DEFAULT_CONFIG } from '../src/game/config.js';
import { createInitialTeamState, simulateWeek, isFinished } from '../src/game/engine.js';
import { aiDecide } from '../src/game/ai.js';

describe('회귀 — 단일 HTML과 동일 결과', () => {
  test('36주 모두 AI: 누적비용/재고/백오더 정확히 일치', () => {
    const config = { ...DEFAULT_CONFIG, weeks: 36 };
    const state = createInitialTeamState(config);
    while (!isFinished(state, config)) {
      const orders = {};
      for (const id of ROLE_IDS) orders[id] = aiDecide(state, id, config);
      simulateWeek(state, orders, config);
    }

    // outputs/test_sim.js 실행 결과:
    //   Retailer    재고 4,   백오더 0, 누적비용 $449.00
    //   Wholesaler  재고 129, 백오더 0, 누적비용 $2269.00
    //   Distributor 재고 467, 백오더 0, 누적비용 $5362.50
    //   Factory     재고 397, 백오더 0, 누적비용 $5770.00
    //   총 비용: $13850.50
    const expected = {
      retailer:    { inventory: 4,   backlog: 0, totalCost: 449.00  },
      wholesaler:  { inventory: 129, backlog: 0, totalCost: 2269.00 },
      distributor: { inventory: 467, backlog: 0, totalCost: 5362.50 },
      factory:     { inventory: 397, backlog: 0, totalCost: 5770.00 }
    };

    let totalCost = 0;
    for (const id of ROLE_IDS) {
      const r = state.roles[id];
      const e = expected[id];
      assert.equal(r.inventory, e.inventory, `${id} 최종 재고`);
      assert.equal(r.backlog, e.backlog, `${id} 최종 백오더`);
      // 부동소수점 비교 — 1센트 이내
      assert.ok(Math.abs(r.totalCost - e.totalCost) < 0.01,
        `${id} 누적비용 ${r.totalCost} != ${e.totalCost}`);
      totalCost += r.totalCost;
    }
    assert.ok(Math.abs(totalCost - 13850.50) < 0.01, `총 비용 ${totalCost} != 13850.50`);
  });

  test('주문 변동성 증폭 (채찍효과) 단일 HTML과 동일', () => {
    // 단일 HTML의 결과:
    //   Retailer    표준편차 10.37 (8.25배 증폭)
    //   Wholesaler  표준편차 22.80 (18.14배)
    //   Distributor 표준편차 47.18 (37.53배)
    //   Factory     표준편차 74.99 (59.65배)
    const config = { ...DEFAULT_CONFIG, weeks: 36 };
    const state = createInitialTeamState(config);
    while (!isFinished(state, config)) {
      const orders = {};
      for (const id of ROLE_IDS) orders[id] = aiDecide(state, id, config);
      simulateWeek(state, orders, config);
    }

    function stddev(arr) {
      const m = arr.reduce((a, b) => a + b, 0) / arr.length;
      return Math.sqrt(arr.reduce((s, x) => s + (x - m) ** 2, 0) / arr.length);
    }

    const expectedStds = {
      retailer:    10.37,
      wholesaler:  22.80,
      distributor: 47.18,
      factory:     74.99
    };
    for (const id of ROLE_IDS) {
      const std = stddev(state.roles[id].orderHistory);
      assert.ok(Math.abs(std - expectedStds[id]) < 0.05,
        `${id} 표준편차 ${std.toFixed(2)} != ${expectedStds[id]}`);
    }
  });
});
