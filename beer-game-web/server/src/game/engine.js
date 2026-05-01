// 게임 엔진 — 한 팀의 공급사슬을 한 주씩 시뮬레이션.
// 단일 HTML 버전(beer_game.html)의 simulateWeek과 1:1 일치하도록 이식했음.
// 모든 함수는 순수 함수에 가깝게 유지: state를 직접 변형하지만 부수효과(I/O, 시간) 없음.

import {
  ROLES, ROLE_IDS,
  downstreamOf, upstreamOf, getCustomerDemand
} from './config.js';

// 한 팀의 초기 상태를 만든다. config의 startInv, shipDelay, orderDelay를 따름.
// 단일 HTML과 동일하게 시작 재고 12, 파이프라인 4단위로 채움.
export function createInitialTeamState(config) {
  const state = {
    week: 1,
    customerDemandHistory: [],
    roles: {}
  };
  for (const role of ROLES) {
    state.roles[role.id] = {
      inventory: config.startInv,
      backlog: 0,
      totalCost: 0,
      // 큐는 처음엔 4 단위로 채워짐 (공급사슬이 정상 운영되고 있다는 가정)
      incomingShipments: Array(config.shipDelay).fill(4),
      incomingOrders: Array(config.orderDelay).fill(4),
      // 시계열 기록 (차트/CSV용)
      orderHistory: [],
      inventoryHistory: [],
      backlogHistory: [],
      costHistory: [],
      shipmentHistory: []
    };
  }
  return state;
}

// 한 주 진행. orders는 { retailer, wholesaler, distributor, factory } 형식.
// state를 in-place로 변형하고, 반환값은 이 주의 스냅샷(history 행으로 쓰기 좋게).
export function simulateWeek(state, orders, config, rng) {
  // 입력 검증
  for (const role of ROLES) {
    const v = orders[role.id];
    if (!Number.isFinite(v) || v < 0) {
      throw new Error(`잘못된 주문량: ${role.id}=${v}`);
    }
  }

  const customerDemand = getCustomerDemand(state.week, config.demand, rng);
  state.customerDemandHistory.push(customerDemand);

  // 단일 HTML과 동일한 처리 순서 — 소매상부터 공장까지 일렬로 처리.
  // (한 단계의 출하가 같은 주의 다음 단계 큐에 들어갈 수도 있지만,
  //  shipDelay - 1 만큼 0을 채워서 실질적으로는 다음 주차에 도착하도록 처리.)
  for (const role of ROLES) {
    const r = state.roles[role.id];

    // 1. 입고 — 큐의 첫 항목을 받음
    const arriving = r.incomingShipments.shift() || 0;
    r.inventory += arriving;

    // 2. 주문 받기 — 소매상은 고객 수요, 그 외는 큐의 첫 항목
    const incomingDemand = role.id === 'retailer'
      ? customerDemand
      : (r.incomingOrders.shift() || 0);
    const totalDemand = r.backlog + incomingDemand;

    // 3. 출하 — 재고가 충분하면 모두, 부족하면 백오더
    const shipped = Math.min(r.inventory, totalDemand);
    r.inventory -= shipped;
    r.backlog = totalDemand - shipped;
    r.shipmentHistory.push(shipped);

    // 출하분을 하류 큐에 추가 (배송 지연 후 도착)
    const downstream = downstreamOf(role.id);
    if (downstream) {
      const dq = state.roles[downstream].incomingShipments;
      while (dq.length < config.shipDelay - 1) dq.push(0);
      dq.push(shipped);
    }
    // 소매상은 고객에게 출하 — 큐 없음

    // 4. 비용
    const weekCost = r.inventory * config.holdCost + r.backlog * config.backCost;
    r.totalCost += weekCost;
    r.inventoryHistory.push(r.inventory);
    r.backlogHistory.push(r.backlog);
    r.costHistory.push(r.totalCost);

    // 5. 새 주문
    const myOrder = orders[role.id];
    r.orderHistory.push(myOrder);

    const upstream = upstreamOf(role.id);
    if (upstream) {
      const uq = state.roles[upstream].incomingOrders;
      while (uq.length < config.orderDelay - 1) uq.push(0);
      uq.push(myOrder);
    } else {
      // 공장: 자기 자신에게 생산 주문 (shipDelay 후 자기 재고에 도착)
      while (r.incomingShipments.length < config.shipDelay - 1) r.incomingShipments.push(0);
      r.incomingShipments.push(myOrder);
    }

    // 큐 길이 정규화 (필요시 0으로 채움)
    while (r.incomingShipments.length < config.shipDelay) r.incomingShipments.push(0);
    if (role.id !== 'retailer') {
      while (r.incomingOrders.length < config.orderDelay) r.incomingOrders.push(0);
    }
  }

  const snapshot = {
    week: state.week,
    customerDemand,
    roles: ROLE_IDS.reduce((acc, id) => {
      const r = state.roles[id];
      acc[id] = {
        inventory: r.inventory,
        backlog: r.backlog,
        totalCost: r.totalCost,
        order: r.orderHistory[r.orderHistory.length - 1],
        shipped: r.shipmentHistory[r.shipmentHistory.length - 1]
      };
      return acc;
    }, {})
  };

  state.week += 1;
  return snapshot;
}

// 게임 종료 여부
export function isFinished(state, config) {
  return state.week > config.weeks;
}
