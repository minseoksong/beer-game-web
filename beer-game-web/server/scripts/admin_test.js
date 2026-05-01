// 관리자 API 검증 — 강제진행, 팀 상세, CSV 내보내기

import { io } from 'socket.io-client';

const BASE = process.env.BASE_URL || 'http://localhost:3001';

async function jget(url, opts = {}) {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) }, ...opts });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`HTTP ${res.status}: ${t}`);
  }
  return res.json();
}
async function ttext(url, opts = {}) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  console.log('=== 1. 세션 생성 (3팀, 6주) ===');
  const session = await jget(`${BASE}/api/sessions`, {
    method: 'POST',
    body: JSON.stringify({ teamCount: 3, config: { weeks: 6 } })
  });
  console.log(`코드 ${session.code}`);

  console.log('\n=== 2. 첫 팀에 사람 1명만 합류 (소매상) ===');
  const v = await jget(`${BASE}/api/sessions/code/${session.code}`);
  const team1 = v.teams[0];
  const join = await jget(`${BASE}/api/teams/${team1.id}/join`, {
    method: 'POST',
    body: JSON.stringify({ role: 'retailer', name: '학생A' })
  });

  console.log('\n=== 3. 게임 시작 (나머지 자리 AI로) ===');
  await jget(`${BASE}/api/sessions/${session.id}/start?token=${session.adminToken}`, { method: 'POST' });

  console.log('\n=== 4. 팀 상세 조회 (관리자) ===');
  const detail = await jget(`${BASE}/api/sessions/${session.id}/teams/${team1.id}?token=${session.adminToken}`);
  console.log(`팀: ${detail.name}, 주: ${detail.currentWeek}, 종료: ${detail.isFinished}`);
  console.log(`occupants: ${detail.occupants.map(o => `${o.role}=${o.name}${o.isAi?'(AI)':''}`).join(', ')}`);

  console.log('\n=== 5. 사람이 주문 안하고 멈춰있을 때 강제 진행 ===');
  // socket 연결 — 사람 자리 입장만
  const socket = io(BASE, { auth: { playerToken: join.playerToken }, transports: ['websocket'] });
  await sleep(300);
  // pending 확인
  const detail2 = await jget(`${BASE}/api/sessions/${session.id}/teams/${team1.id}?token=${session.adminToken}`);
  const submitted = Object.entries(detail2.pendingOrders).filter(([_,v]) => v != null).map(([k]) => k);
  console.log(`현재 제출됨: ${submitted.join(', ') || '(없음)'} — AI들은 즉시 결정했어야 함`);
  console.log(`사람 자리(retailer) 미제출 상태에서 강제 진행 호출`);

  await jget(`${BASE}/api/sessions/${session.id}/teams/${team1.id}/force-advance?token=${session.adminToken}`, { method: 'POST' });
  await sleep(300);
  const detail3 = await jget(`${BASE}/api/sessions/${session.id}/teams/${team1.id}?token=${session.adminToken}`);
  console.log(`강제 진행 후 주차: ${detail3.currentWeek} (${detail2.currentWeek}에서 +1되어야 함)`);

  console.log('\n=== 6. 모든 팀이 끝나도록 강제 진행 반복 (5번 더) ===');
  for (let i = 0; i < 5; i++) {
    for (const t of v.teams) {
      try {
        await jget(`${BASE}/api/sessions/${session.id}/teams/${t.id}/force-advance?token=${session.adminToken}`, { method: 'POST' });
      } catch (e) {
        // 이미 끝났을 수 있음 — 무시
      }
    }
    await sleep(200);
  }

  console.log('\n=== 7. 최종 상태 ===');
  const final = await jget(`${BASE}/api/sessions/${session.id}?token=${session.adminToken}`);
  for (const t of final.teams) {
    console.log(`  ${t.name}: 주 ${t.currentWeek}, 종료=${t.isFinished}, 비용 $${(t.totalCost||0).toFixed(2)}`);
  }

  console.log('\n=== 8. CSV 내보내기 ===');
  const csv = await ttext(`${BASE}/api/sessions/${session.id}/export.csv?token=${session.adminToken}`);
  const lines = csv.split('\n').filter(l => l.trim());
  console.log(`헤더: ${lines[0].slice(0, 80)}...`);
  console.log(`데이터 행: ${lines.length - 1}개 (3팀 × 6주 = 18 예상)`);
  console.log(`첫 데이터 행: ${lines[1]}`);

  console.log('\n=== 9. 검증 ===');
  let pass = true;
  const checks = [
    ['팀 상세 조회 성공', detail.name === '1조'],
    ['강제 진행 후 주차 증가', detail3.currentWeek > detail2.currentWeek],
    ['모든 팀 종료', final.teams.every(t => t.isFinished)],
    ['CSV 헤더에 주요 컬럼 포함', lines[0].includes('Week') && lines[0].includes('retailer_Order')],
    ['CSV 데이터 18행', lines.length - 1 === 18]
  ];
  for (const [name, ok] of checks) {
    console.log(`  ${ok ? '✅' : '❌'} ${name}`);
    if (!ok) pass = false;
  }

  socket.disconnect();
  console.log(pass ? '\n🎉 ALL PASS' : '\n💥 FAIL');
  process.exit(pass ? 0 : 1);
}

main().catch(err => { console.error(err); process.exit(1); });
