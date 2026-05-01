// 결과 비교 API 검증

const BASE = process.env.BASE_URL || 'http://localhost:3001';

async function jget(url, opts = {}) {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) }, ...opts });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`HTTP ${res.status}: ${t}`);
  }
  return res.json();
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  console.log('=== 1. 세션 생성 (3팀, 6주) ===');
  const session = await jget(`${BASE}/api/sessions`, {
    method: 'POST',
    body: JSON.stringify({ teamCount: 3, config: { weeks: 6 } })
  });
  console.log(`코드 ${session.code}`);

  console.log('\n=== 2. 진행 전 결과 API 호출 (빈 배열 예상) ===');
  const r1 = await jget(`${BASE}/api/sessions/code/${session.code}/results`);
  console.log(`팀 종료 수: ${r1.teams.length}`);

  console.log('\n=== 3. 게임 시작 → 모두 AI 자동 진행 ===');
  await jget(`${BASE}/api/sessions/${session.id}/start?token=${session.adminToken}`, { method: 'POST' });
  // AI들이 자동으로 모든 주차 진행하길 잠시 기다림 (autoSubmitAi가 즉시 결정)
  await sleep(1500);

  console.log('\n=== 4. 종료 후 결과 API 호출 ===');
  const r2 = await jget(`${BASE}/api/sessions/code/${session.code}/results`);
  console.log(`종료된 팀 수: ${r2.teams.length}`);
  for (const t of r2.teams) {
    console.log(`  ${t.name}: 비용 $${t.summary.totalCost.toFixed(2)}, 최대 증폭 ${t.summary.maxAmplification.toFixed(2)}배, history ${t.history.length}주`);
  }

  console.log('\n=== 5. summary 구조 검증 ===');
  const t0 = r2.teams[0];
  console.log(`  totalCost: ${typeof t0.summary.totalCost}`);
  console.log(`  customerDemandStd: ${t0.summary.customerDemandStd?.toFixed(2)}`);
  console.log(`  maxAmplification: ${t0.summary.maxAmplification?.toFixed(2)}`);
  console.log(`  perRole 키: ${Object.keys(t0.summary.perRole).join(', ')}`);
  console.log(`  perRole.factory.orderStd: ${t0.summary.perRole.factory.orderStd?.toFixed(2)}`);

  console.log('\n=== 6. history 구조 검증 ===');
  const h0 = t0.history[0];
  console.log(`  주: ${h0.week}, 고객수요: ${h0.customerDemand}`);
  console.log(`  roles 키: ${Object.keys(h0.roles).join(', ')}`);
  console.log(`  retailer: order=${h0.roles.retailer.order}, inv=${h0.roles.retailer.inventory}, cost=${h0.roles.retailer.totalCost}`);

  console.log('\n=== 7. 검증 ===');
  let pass = true;
  const checks = [
    ['진행 전 빈 배열', r1.teams.length === 0],
    ['종료 후 3팀 데이터', r2.teams.length === 3],
    ['모든 팀이 6주 history', r2.teams.every(t => t.history.length === 6)],
    ['summary.perRole 4개 역할', Object.keys(t0.summary.perRole).length === 4],
    ['history.roles 4개 역할', Object.keys(h0.roles).length === 4],
    ['summary.totalCost 양수', t0.summary.totalCost > 0],
    ['summary.maxAmplification 1배 이상', t0.summary.maxAmplification >= 1]
  ];
  for (const [name, ok] of checks) {
    console.log(`  ${ok ? '✅' : '❌'} ${name}`);
    if (!ok) pass = false;
  }

  console.log(pass ? '\n🎉 ALL PASS' : '\n💥 FAIL');
  process.exit(pass ? 0 : 1);
}

main().catch(err => { console.error(err); process.exit(1); });
