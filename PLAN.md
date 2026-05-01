# 맥주 분배 게임 — 웹 멀티팀 시스템 설계 계획

## 1. 개요

**목표**: 다수의 팀이 각자 다른 컴퓨터/디바이스에서 웹으로 접속하여, 자기 팀의 자기 역할로 로그인해 함께 게임을 진행하는 시스템.

**범위 (Scope)**:
- 한 세션에 1~20팀 동시 진행 (관리자가 세션 생성 시 팀 개수 설정)
- 각 팀은 4명(소매상, 도매상, 유통업자, 공장)으로 구성
- 사람이 부족한 자리는 AI가 자동으로 채움
- 한 컴퓨터(또는 단일 VPS)에서 호스팅
- 강사/관리자가 세션을 만들고 코드를 배포 → 학생들이 각자 접속

**범위에서 제외 (Out of Scope)**:
- 정식 회원가입/이메일 인증
- 결제, 다중 조직 관리(SaaS 기능)
- 모바일 네이티브 앱 (반응형 웹으로 대신)
- 수천 명 동시 접속을 위한 수평 확장

## 2. 시스템 아키텍처

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  관리자 브라우저  │     │  팀1-소매상 PC   │     │  팀1-도매상 PC   │   ...
│  (admin.html)   │     │  (player.html)  │     │  (player.html)  │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         │  WebSocket            │  WebSocket            │  WebSocket
         │  + REST               │                       │
         └───────────────────────┴───────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │   Node.js 서버 (Express + Socket.io)   │
                    │   - 인증 (코드 기반)                    │
                    │   - 게임 엔진 (역할별 시뮬레이션)        │
                    │   - 세션/팀 상태 관리                  │
                    │   - 실시간 브로드캐스트                 │
                    └────────────┬────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │   SQLite (단일 파일 DB)   │
                    │   - sessions, teams,    │
                    │     players, game_state,│
                    │     history             │
                    └─────────────────────────┘
```

**핵심 원칙**:
- **단일 프로세스, 단일 DB 파일**: 운영 단순성. 백업은 SQLite 파일 복사로 충분.
- **WebSocket 우선, REST 보조**: 실시간 게임 상태 푸시는 WebSocket. 로그인/세션 생성처럼 1회성 작업은 REST.
- **클라이언트는 dumb, 서버가 진실의 원천(SoT)**: 게임 로직은 모두 서버에 있고, 클라이언트는 서버가 보내준 상태를 렌더링만 함. 부정행위 방지 + 일관성 보장.

## 3. 기술 스택

| 계층 | 선택 | 이유 |
|------|------|------|
| 프론트엔드 | React 18 + Vite | 빠른 개발, 익숙한 생태계 |
| 스타일 | Tailwind CSS | 단일 HTML 게임에서 검증된 디자인 토큰 재사용 |
| 차트 | Chart.js | 단일 HTML 버전과 동일, 학습 곡선 없음 |
| 상태관리 | React Context + useReducer | Redux 오버킬, 게임 상태가 단순 |
| 백엔드 | Node.js 20 + Express + Socket.io | WebSocket 표준, 한국어 자료 풍부 |
| DB | better-sqlite3 (동기 SQLite) | 단일 호스트 + 10팀 규모에 충분, 운영 부담 0 |
| 인증 | JWT (HS256) + 세션 코드 | Passport, bcrypt 같은 라이브러리 불필요 |
| 빌드/번들 | Vite (프론트), 백엔드는 그대로 실행 | dev/prod 모두 빠름 |
| 배포 | 단일 Docker 컨테이너 OR pm2 | 어디서든 `docker run` 한 줄 실행 |

## 4. 데이터 모델 (SQLite 스키마)

```sql
-- 강사가 만드는 게임 세션
CREATE TABLE sessions (
  id              TEXT PRIMARY KEY,           -- UUID
  code            TEXT UNIQUE NOT NULL,       -- 6자리 (예: ABCD12)
  admin_token     TEXT NOT NULL,              -- 관리자 인증용
  team_count      INTEGER NOT NULL,           -- 팀 개수 (1~20). 세션 생성 시 결정
  config_json     TEXT NOT NULL,              -- 게임 규칙 JSON (주차, 지연, 비용 등)
  status          TEXT NOT NULL,              -- 'lobby' | 'running' | 'finished'
  created_at      INTEGER NOT NULL,
  finished_at     INTEGER
);

-- 한 세션 안의 팀
CREATE TABLE teams (
  id              TEXT PRIMARY KEY,           -- UUID
  session_id      TEXT NOT NULL,
  name            TEXT NOT NULL,              -- "1조" 등
  current_week    INTEGER NOT NULL DEFAULT 1,
  state_json      TEXT NOT NULL,              -- 4역할의 inventory, backlog, queue 등
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- 한 팀의 한 역할에 로그인한 플레이어
CREATE TABLE players (
  id              TEXT PRIMARY KEY,
  team_id         TEXT NOT NULL,
  role            TEXT NOT NULL,              -- 'retailer'|'wholesaler'|'distributor'|'factory'
  display_name    TEXT NOT NULL,
  player_token    TEXT UNIQUE NOT NULL,       -- 재접속용 토큰
  is_ai           INTEGER NOT NULL DEFAULT 0,
  joined_at       INTEGER NOT NULL,
  last_seen_at    INTEGER,
  UNIQUE(team_id, role)
);

-- 주별 의사결정 + 결과 스냅샷 (분석/CSV 출력용)
CREATE TABLE history (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id         TEXT NOT NULL,
  week            INTEGER NOT NULL,
  role            TEXT NOT NULL,
  order_qty       INTEGER NOT NULL,
  inventory       INTEGER NOT NULL,
  backlog         INTEGER NOT NULL,
  shipped         INTEGER NOT NULL,
  cost            REAL NOT NULL,
  customer_demand INTEGER,                    -- retailer 행에만 의미
  recorded_at     INTEGER NOT NULL
);
```

**주요 결정**:
- 게임 상태(큐, 재고)는 `teams.state_json`에 JSON으로 저장. 매주 끝에 스냅샷을 `history`에 행 단위로 기록 → 차트/CSV 출력 시 인덱스만 잡으면 빠름.
- `players.player_token`을 쿠키에 저장하면 페이지 새로고침/재접속에도 자기 자리로 복귀 가능.
- 외래키는 ON DELETE CASCADE — 세션 삭제 시 모두 정리.

## 5. 인증 및 접속 흐름

### 5.1 관리자
1. 관리자 페이지(`/admin`)에서 "새 세션 만들기" 클릭
2. **팀 개수(1~20)** + 게임 규칙(주차, 지연, 비용 등) 입력 후 생성
3. 서버가 팀 개수만큼 빈 팀("1조"~"N조") 자동 생성
4. 서버는 6자리 세션 코드 + 관리자 URL 발급 (`https://host/s/ABCD12/admin?token=...`)
5. 관리자는 화면에 세션 코드 + QR을 띄워 학생들에게 공유

### 5.2 학생 (팀 합류)
1. 학생이 `/join` 접속 → 세션 코드 입력
2. 팀 선택 화면: 기존 팀 목록(빈 자리 표시) + "새 팀 만들기"
3. 팀 + 역할 + 이름 입력 → 서버가 `player_token`을 쿠키에 저장하고 게임 화면으로 리디렉션
4. WebSocket 연결 (`socket.auth.token = player_token`)

### 5.3 재접속/연결 끊김
- 클라이언트는 쿠키의 `player_token`으로 자동 재연결
- 서버는 토큰 검증 → 해당 플레이어의 마지막 상태 푸시
- 60초 이상 끊긴 자리는 임시 AI로 자동 대체 (관리자 옵션)

### 5.4 토큰 구조 (JWT 페이로드)
```js
// 플레이어 토큰
{ pid: 'uuid', tid: 'uuid', sid: 'uuid', role: 'retailer', exp: ... }
// 관리자 토큰
{ sid: 'uuid', kind: 'admin', exp: ... }
```

## 6. WebSocket 이벤트 명세

### 클라이언트 → 서버
| 이벤트 | 페이로드 | 설명 |
|--------|----------|------|
| `team:join` | `{token}` | 룸 참가, 초기 상태 수신 |
| `order:submit` | `{week, qty}` | 이번 주 주문량 제출 |
| `order:revise` | `{week, qty}` | 다른 멤버 미제출 시 수정 가능 |
| `chat:send` | `{text}` | 같은 팀 내 채팅 (선택 기능) |

### 서버 → 클라이언트 (룸 브로드캐스트)
| 이벤트 | 페이로드 | 설명 |
|--------|----------|------|
| `state:full` | `{team, players, week, history}` | 입장 시 전체 상태 |
| `state:patch` | `{week, role, fields}` | 부분 업데이트 (재고/주문 등) |
| `week:advanced` | `{week, snapshot}` | 한 주 진행 완료 시 |
| `player:joined` | `{role, name}` | 동료가 들어옴 |
| `player:left` | `{role}` | 동료 연결 끊김 |
| `game:finished` | `{summary}` | 모든 주차 종료 |

### 관리자 전용 룸 (`session:{id}:admin`)
| 이벤트 | 설명 |
|--------|------|
| `session:state` | 모든 팀의 진행도, 비용 요약 (대시보드) |
| `team:event` | 특정 팀에서 발생한 이벤트 푸시 |

## 7. REST API (보조)

```
POST   /api/sessions                   세션 생성 (관리자)
GET    /api/sessions/:code             세션 메타 (코드로 조회, 인증 불필요)
POST   /api/sessions/:code/teams       팀 생성/합류
GET    /api/sessions/:id/admin         관리자 대시보드 데이터
POST   /api/sessions/:id/finish        조기 종료 (관리자)
GET    /api/sessions/:id/export.csv    전체 결과 CSV
```

## 8. 핵심 게임 진행 로직 (서버)

자동 진행 모드의 핵심 메커니즘:

```js
// 한 팀의 한 주 진행
async function tryAdvanceTeam(teamId) {
  const team = await getTeam(teamId);
  const orders = team.state.pendingOrders; // {retailer, wholesaler, ...}

  // 모든 역할이 주문 제출했는지 확인
  for (const role of ROLES) {
    if (orders[role] == null) {
      const player = await getPlayer(teamId, role);
      // AI 자동 결정 (사람 자리가 비어있고 일정 시간 지났거나, 처음부터 AI)
      if (player.is_ai || isStale(player)) {
        orders[role] = aiDecide(team.state, role);
      } else {
        return; // 아직 누군가 주문 안 했음 → 대기
      }
    }
  }

  // 시뮬레이션 한 주 진행 (단일 HTML 버전과 동일 로직)
  const newState = simulateWeek(team.state, orders);

  // DB 업데이트 + history 행 추가
  await saveTeamState(teamId, newState);
  await insertHistoryRows(teamId, newState);

  // WebSocket 브로드캐스트
  io.to(`team:${teamId}`).emit('week:advanced', { week, snapshot });
  io.to(`session:${team.session_id}:admin`).emit('team:event', { teamId, week });

  // 종료 조건
  if (newState.week > config.weeks) {
    await markFinished(teamId);
    io.to(`team:${teamId}`).emit('game:finished', summary);
  }
}
```

서버에는 30초마다 도는 타이머가 있어 "지각자" 자리를 AI로 자동 대체할 수 있도록 함.

## 9. 화면 설계

### 9.1 관리자 화면 (`/admin/:sessionId`)
- 상단: 세션 코드 큰 글씨 + QR 코드 + 참가자 수
- 좌측: 팀 목록(진행도 바, 비용, 상태 — 진행중/지각/완료)
- 우측: 선택된 팀의 실시간 상태 (4역할 카드 미리보기)
- 하단: 전체 통계 (가장 빠른 팀, 평균 비용, 채찍효과 평균 증폭률)

### 9.2 합류 화면 (`/join`)
- 6자리 코드 입력 (큰 입력창)
- → 팀 선택 (또는 신규 팀)
- → 역할 선택 (이미 점유된 역할은 비활성)
- → 이름 입력 → 게임 시작

### 9.3 플레이어 게임 화면 (`/play`)
- 자기 역할 카드(대형)
- 하류 동료, 상류 동료 정보 (정보 격리 모드 설정에 따라 가시 범위 달라짐)
- 주차 진행도 + 동료 제출 상태 ("도매상 제출 ✓, 유통업자 대기...")
- 차트 토글 (자기 역할 + 자기 하류만 보임)
- 채팅 패널 (선택)

### 9.4 결과 화면 (`/results/:teamId`)
- 단일 HTML 버전과 동일한 점수판 + 차트
- 추가: 같은 세션 다른 팀과 비교 ("우리 팀 순위: 3/8")

## 10. 디렉토리 구조 (제안)

```
beer-game-web/
├── server/
│   ├── src/
│   │   ├── index.js              # Express + Socket.io 부트
│   │   ├── db.js                 # SQLite 초기화/쿼리
│   │   ├── auth.js               # JWT 발급/검증
│   │   ├── game/
│   │   │   ├── engine.js         # simulateWeek, AI 정책
│   │   │   ├── config.js         # 기본 게임 규칙
│   │   │   └── advancer.js       # 자동 진행 + AI 대체 타이머
│   │   ├── routes/
│   │   │   ├── sessions.js
│   │   │   ├── teams.js
│   │   │   └── export.js
│   │   └── sockets/
│   │       ├── player.js         # 플레이어 룸 핸들러
│   │       └── admin.js          # 관리자 룸 핸들러
│   ├── migrations/
│   │   └── 001_init.sql
│   └── package.json
├── client/
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx
│   │   ├── pages/
│   │   │   ├── Join.jsx
│   │   │   ├── Play.jsx
│   │   │   ├── Admin.jsx
│   │   │   └── Results.jsx
│   │   ├── components/
│   │   │   ├── RoleCard.jsx
│   │   │   ├── PipelineDisplay.jsx
│   │   │   ├── BullwhipChart.jsx
│   │   │   └── TeamRoster.jsx
│   │   ├── hooks/
│   │   │   ├── useSocket.js
│   │   │   └── useGameState.js
│   │   └── lib/
│   │       └── api.js
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── docker-compose.yml
├── Dockerfile
├── README.md
└── .env.example
```

## 11. 구현 단계 (Phase별 로드맵)

목표: 각 Phase가 끝났을 때 **실제로 동작하는** 무언가가 나오도록 자르기.

### Phase 1 — 기초 골격 (예상 4~6시간)
- 프로젝트 스캐폴딩 (Vite, Express, SQLite)
- DB 스키마 마이그레이션
- 관리자 세션 생성 API + 화면
- 단순 코드 입력 합류 화면 (DB까지 다녀오기, 게임 X)
- ✅ **완료 기준**: 관리자가 세션 만들고, 다른 브라우저에서 코드로 합류해 팀에 들어가는 모습이 보임

### Phase 2 — 게임 엔진 이식 (예상 3~4시간)
- 단일 HTML의 `simulateWeek` 로직을 서버 모듈로 이식 (`server/src/game/engine.js`)
- AI 정책 동일하게 이식
- 단위 테스트 작성 (현재 `test_sim.js`를 Jest/Vitest로 이전)
- ✅ **완료 기준**: 서버 단독으로 36주 시뮬레이션 돌려서 단일 HTML과 동일 결과 확인

### Phase 3 — WebSocket 실시간 게임플레이 (예상 5~7시간)
- Socket.io 룸 구조 (팀별 룸, 관리자 룸)
- `order:submit` → 모든 멤버 제출 시 자동 진행
- 30초 타이머로 미제출자 AI 대체
- 플레이어 화면에서 차트 + 4역할 표시 (자기 정보 격리 적용)
- ✅ **완료 기준**: 4명이 다른 브라우저에서 들어와 36주 게임을 끝까지 진행 가능

### Phase 4 — 관리자 대시보드 (예상 3~4시간)
- 모든 팀 진행도 실시간 표시
- 팀별 드릴다운
- 세션 종료 + CSV 내보내기
- ✅ **완료 기준**: 강사가 한 화면에서 8개 팀의 진행 현황을 한눈에 봄

### Phase 5 — 결과 화면 + 팀 비교 (예상 2~3시간)
- 단일 HTML의 결과/학습 포인트 이식
- 같은 세션 내 팀별 순위
- 채찍효과 비교 차트
- ✅ **완료 기준**: 게임 종료 후 학생이 자기 팀 결과 + 다른 팀과 비교 가능

### Phase 6 — 배포 + 운영 강화 (예상 2~3시간)
- Dockerfile + docker-compose
- 환경변수, 로깅 (pino)
- 재접속(쿠키 토큰) 안정화
- README 작성
- ✅ **완료 기준**: `docker compose up` 한 줄로 다른 컴퓨터에서도 실행됨

**총 예상 소요**: 약 19~27시간 (1~2주 파트타임 작업).

## 12. 운영/배포

### 로컬 (강사 노트북)
```bash
docker compose up    # 80, 443 포트 노출
# 또는
cd server && npm start &
cd client && npm run build && serve -s dist
```
강사 노트북의 IP를 학생들에게 공유 (예: `http://192.168.0.42:8080/join`).
같은 와이파이망에서 접속 — 학교 환경에서 일반적.

### 작은 VPS (외부 접속 필요할 때)
- AWS Lightsail / DigitalOcean / Vultr — 월 $5~10
- 도메인 + Let's Encrypt SSL (Caddy 자동 처리)
- SQLite 파일은 볼륨 마운트로 영속화

### 백업/복구
- `cron`으로 매일 SQLite 파일 복사 (1MB 미만 예상)
- 세션 종료 시 CSV 자동 내보내기 → 별도 폴더 보관

## 13. 보안 고려사항 (수업용 수준)

- HTTPS 필수 (외부 노출 시) — Caddy로 자동 발급
- 세션 코드는 6자리지만 brute-force 방지: 같은 IP에서 분당 10회 시도 제한
- 관리자 토큰은 URL에 노출되지 않게 — 첫 접속 후 쿠키로 옮기고 URL 정리
- XSS 방지: 사용자 입력은 React 기본 이스케이핑 + 채팅은 텍스트만 (HTML 금지)
- 프로덕션에서 `helmet`, `express-rate-limit` 적용
- ⚠️ 이 시스템은 학습용 — 의료/금융 같은 민감 데이터는 안 다룸

## 14. 향후 확장 가능성 (Out of Scope이지만 메모)

- **수평 확장**: Redis Pub/Sub으로 다중 Node 인스턴스 (50팀 이상 시 검토)
- **분석 대시보드**: 누적 게임 통계, 학생별 성장 추적
- **시나리오 라이브러리**: 강사가 사전 정의된 수요 패턴(SARS, 코로나, 명절 등)을 선택
- **모바일 최적화**: 현재 반응형으로 충분 — 필요 시 PWA 전환
- **다국어**: i18n 라이브러리 도입 (한국어/영어/일본어)
- **AI 정책 튜닝**: 학생이 base-stock 외 다른 정책(MMSE, RL 등) 선택해서 비교
- **녹화/리플레이**: history 테이블을 시간순 재생

## 15. 핵심 위험과 대응

| 위험 | 가능성 | 영향 | 대응 |
|------|--------|------|------|
| 학생 와이파이 끊김 → 게임 진행 멈춤 | 중 | 중 | 30초 타이머 + AI 대체. 재접속 시 자동 복귀 |
| 한 명이 답을 안 함 → 다른 팀원 멈춤 | 높음 | 중 | 위와 동일. 관리자가 강제 진행 버튼 |
| 강사 노트북 다운 | 낮음 | 높음 | SQLite 파일만 백업되면 재시작으로 복구 |
| 부정행위 (다른 팀 정보 훔쳐보기) | 낮음 | 낮음 | 정보는 서버에서 필터링해서 푸시 — 클라이언트가 가질 수 없음 |
| 게임 로직 버그로 비용 폭주 | 중 | 중 | Phase 2의 단위 테스트 + 단일 HTML 결과와 회귀 비교 |

## 16. 다음 액션

1. 이 계획서 검토 및 승인
2. Phase 1 시작: `beer-game-web/` 디렉토리 스캐폴딩
3. Phase 2 완료 시점에 단일 HTML 버전과 시뮬레이션 결과 1:1 일치 검증
4. Phase 3 끝나면 4명 동료/지인과 베타 테스트 한 번
5. 첫 실제 수업 1주 전에 Phase 6 마무리
