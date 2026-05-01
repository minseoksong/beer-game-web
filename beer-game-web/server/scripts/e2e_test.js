// E2E 테스트 — 실제 서버에 HTTP + WebSocket으로 접속해 게임 한 판 진행
// 실행: 서버를 다른 터미널에서 띄우고 `node scripts/e2e_test.js`

import { io } from 'socket.io-client';

const BASE = process.env.BASE_URL || 'http://localhost:3001';

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('=== 1. 헬스체크 ===');
  const h = await fetchJson(`${BASE}/api/health`);
  console.log('OK', h);

  console.log('\n=== 2. 세션 생성 (팀 2개, 8주) ===');
  const session = await fetchJson(`${BASE}/api/sessions`, {
    method: 'POST',
    body: JSON.stringify({ teamCount: 2, config: { weeks: 8 } })
  });
  console.log(`코드 ${session.code}, 세션ID ${session.id.slice(0, 8)}...`);

  console.log('\n=== 3. 1조 정보 조회 ===');
  const view = await fetchJson(`${BASE}/api/sessions/code/${session.code}`);
  const team1 = view.teams[0];
  console.log(`팀: ${team1.name}`);

  console.log('\n=== 4. 1조에 소매상으로 사람 1명 합류 ===');
  const join = await fetchJson(`${BASE}/api/teams/${team1.id}/join`, {
    method: 'POST',
    body: JSON.stringify({ role: 'retailer', name: '테스터' })
  });
  console.log(`플레이어 토큰: ${join.playerToken.slice(0, 10)}...`);

  console.log('\n=== 5. 사람 플레이어 소켓 연결 ===');
  const socket = io(BASE, {
    auth: { playerToken: join.playerToken },
    transports: ['websocket', 'polling']
  });

  let myState = null;
  let weekAdvances = 0;
  let gameFinished = false;

  socket.on('connect', () => console.log('  소켓 연결됨'));
  socket.on('connect_error', (e) => console.error('  소켓 에러:', e.message));
  socket.on('state:full', (data) => {
    console.log(`  state:full — 세션 상태: ${data.session.status}, 주차: ${data.team.currentWeek}`);
    myState = data;
  });
  socket.on('game:started', () => console.log('  game:started 수신'));
  socket.on('week:advanced', (data) => {
    weekAdvances++;
    const totalCost = ['retailer','wholesaler','distributor','factory']
      .reduce((s,r) => s + data.teamState.state.roles[r].totalCost, 0);
    console.log(`  week:advanced — 주 ${data.snapshot.week} 완료, 총비용 $${totalCost.toFixed(2)}`);
    myState = { ...myState, team: data.teamState };
  });
  socket.on('order:submitted', (data) => {
    const submitted = Object.entries(data.pendingOrders).filter(([_,v]) => v != null).map(([k]) => k);
    console.log(`  order:submitted — 현재 제출: ${submitted.join(', ')}`);
  });
  socket.on('order:auto_filled', (data) => {
    console.log(`  order:auto_filled — ${data.count}자리 AI로 채움`);
  });
  socket.on('game:finished', (data) => {
    console.log(`  game:finished — 최종 비용 $${data.summary?.totalCost.toFixed(2)}`);
    gameFinished = true;
  });

  await sleep(500);

  console.log('\n=== 6. 관리자가 게임 시작 ===');
  await fetchJson(`${BASE}/api/sessions/${session.id}/start?token=${session.adminToken}`, { method: 'POST' });
  console.log('  POST /start OK');
  await sleep(500);

  console.log('\n=== 7. 사람 플레이어가 8주 동안 주문 제출 (매주 4) ===');
  for (let w = 1; w <= 8; w++) {
    if (gameFinished) break;
    await new Promise((resolve, reject) => {
      socket.emit('order:submit', { qty: 4 }, (ack) => {
        if (ack?.ok) resolve();
        else reject(new Error(ack?.error || '제출 실패'));
      });
    });
    await sleep(200);
  }
  await sleep(500);

  console.log('\n=== 8. 결과 확인 ===');
  const final = await fetchJson(`${BASE}/api/sessions/${session.id}?token=${session.adminToken}`);
  for (const t of final.teams) {
    console.log(`  ${t.name}: 주 ${t.currentWeek}, 종료=${t.isFinished}, 비용 $${(t.totalCost||0).toFixed(2)}`);
  }

  console.log('\n=== 9. 검증 ===');
  let pass = true;
  const checks = [
    ['team:join 후 state:full 수신', myState !== null],
    ['week:advanced 8회 발생', weekAdvances === 8],
    ['game:finished 수신', gameFinished],
    ['1조 종료', final.teams[0].isFinished === true],
    ['2조 종료 (전부 AI 자동)', final.teams[1].isFinished === true],
    ['1조 8주 진행', final.teams[0].currentWeek === 9],
    ['세션 자동 종료', final.status === 'finished']
  ];
  for (const [name, ok] of checks) {
    console.log(`  ${ok ? '✅' : '❌'} ${name}`);
    if (!ok) pass = false;
  }

  socket.disconnect();
  console.log(pass ? '\n🎉 ALL PASS' : '\n💥 FAIL');
  process.exit(pass ? 0 : 1);
}

main().catch(err => {
  console.error('테스트 실패:', err);
  process.exit(1);
});
