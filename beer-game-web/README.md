# 🍺 맥주 분배 게임 — 웹 멀티팀 버전

MIT Sloan에서 1960년대 개발한 **Beer Distribution Game**의 웹 멀티플레이어 구현.
한 강사가 세션을 만들고 6자리 코드를 학생들에게 배포하면, 각자 다른 컴퓨터/스마트폰에서 접속하여 4역할(소매상/도매상/유통업자/공장)로 한 팀이 되어 공급사슬의 채찍효과(Bullwhip Effect)를 체험하는 시뮬레이션 게임입니다.

수업·세미나·기업 워크숍에서 사용하기 쉽도록 **단일 호스트 + 단일 명령** 실행을 목표로 만들었습니다.

## 핵심 기능

- 1~20팀 동시 진행, 각 팀 4명(빈 자리는 자동으로 AI가 채움)
- **AI 정책 4종**: Base-Stock / Naive / Conservative / Reactive — 채찍효과 비교 학습용
- **고객 수요 패턴 10종**: 계단형 / 일정 / 랜덤 / 증가형 / 계절성 / 팬데믹 급증 / 공급 충격 / 연말 성수기 / 진동 / 이중 계단
- **시나리오 프리셋 5종**: MIT 클래식 / 팬데믹 / 연말 성수기 / 안정 환경 / 카오스 — 한 번에 여러 옵션 적용
- 정보 격리 모드 3종(완전 / 부분 / 개방) — MIT 정통 룰 + 변형
- 실시간 동기화(WebSocket) + 30초 자동 진행 타이머
- 실시간 차트(주문/재고/백오더/누적비용 + 고객 수요 비교선)
- 관리자 대시보드: 모든 팀 진행도 한눈에 모니터링, 비교 차트, 강제 진행, CSV 내보내기
- 결과 화면: 팀 순위, 채찍효과 비교 막대그래프, 자동 인사이트, 성취 배지
- **다국어**: 한국어 / 영어 (브라우저 언어 자동 감지, 헤더에서 토글)
- **DB 옵션**: 기본 JSON 파일 / 선택적 SQLite (50팀 이상 권장)

## 빠른 시작

### Docker (권장 — 한 줄 실행)

Docker가 설치되어 있다면:

```bash
cd beer-game-web
docker compose up -d
```

브라우저에서 `http://localhost:3001/` 접속.

같은 와이파이망의 학생들은 호스트의 IP를 사용 (예: `http://192.168.0.42:3001/`).

### 개발 모드 (Hot Reload)

서버와 클라이언트를 따로 실행하면서 코드 수정 시 즉시 반영됩니다.

**터미널 1 — 서버:**
```bash
cd server
npm install
npm run dev
```

**터미널 2 — 클라이언트:**
```bash
cd client
npm install
npm run dev
```

브라우저에서 `http://localhost:5173/` 접속(클라이언트 포트).

### 프로덕션 빌드 (Docker 없이)

```bash
# 클라이언트 빌드
cd client
npm install && npm run build

# 빌드 결과를 서버의 public 디렉토리로 복사
mkdir -p ../server/public
cp -r dist/* ../server/public/

# 서버 실행 (프로덕션 모드)
cd ../server
npm install --omit=dev
NODE_ENV=production npm start
```

브라우저에서 `http://localhost:3001/` 접속(서버 포트, 정적 파일도 같이 서빙).

## 사용 흐름

1. **관리자**가 `/admin`에서 팀 개수와 게임 규칙을 설정해 세션 생성. 6자리 코드 발급됨.
2. 코드(또는 참가 URL)를 학생들에게 공유.
3. **학생**들이 `/join`에서 코드 입력 → 팀 선택 → 역할 선택 → 이름 입력 → 합류.
4. 관리자가 **🎮 게임 시작** 클릭. 빈 자리는 모두 AI로 자동 채워지고 모든 학생이 게임 화면으로 이동.
5. 각 주차에 4명이 모두 주문 제출 → 자동으로 다음 주 진행. 30초 안에 미제출 시 그 자리만 AI로 자동 결정.
6. 모든 주차 종료 시 결과 화면으로 자동 이동. 같은 세션의 다른 팀과 비교 가능.

## 환경변수

`.env.example` 참고. 운영 시 자주 만지는 값:

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `PORT` | `3001` | HTTP/WebSocket 포트 |
| `NODE_ENV` | `development` | `production`이면 정적 파일 서빙 활성화 |
| `DB_TYPE` | `json` | `json` 또는 `sqlite` (sqlite는 better-sqlite3 별도 설치) |
| `DB_PATH` | `./data.json` | DB 파일 경로 |
| `PUBLIC_DIR` | `./public` | 빌드된 클라이언트 정적 파일 디렉토리 |
| `LOG_LEVEL` | `info` | `trace` / `debug` / `info` / `warn` / `error` |

### SQLite 백엔드로 전환

기본은 JSON 파일이라 외부 의존성 없이 동작합니다. 50팀 이상 또는 영속성 강화가 필요하면 SQLite로 전환:

```bash
cd server
npm install better-sqlite3
DB_TYPE=sqlite DB_PATH=./data.db npm start
```

스키마는 자동으로 마이그레이션됩니다. JSON과 SQLite는 동일 인터페이스를 가지므로 라우트/플로우 코드는 변경되지 않습니다. 단, JSON과 SQLite는 데이터 파일이 다르므로 전환 시 기존 데이터는 이관되지 않습니다.

### HTTPS 외부 노출 (Caddy 자동 인증서)

도메인이 있고 인터넷에 노출하려면 `docker-compose.production.yml`을 사용합니다 — Caddy가 Let's Encrypt 인증서를 자동 발급/갱신합니다.

```bash
# DNS A/AAAA 레코드를 서버 IP로 미리 설정한 다음
DOMAIN=beer-game.example.com docker compose -f docker-compose.production.yml up -d
```

80, 443 포트가 외부에 열려 있어야 합니다(HTTP-01 챌린지용).

## 프로젝트 구조

```
beer-game-web/
├── server/                  # Node.js + Express + Socket.io
│   ├── src/
│   │   ├── index.js         # 엔트리(API + 정적 + 소켓)
│   │   ├── db.js            # JSON 파일 DB
│   │   ├── routes/          # REST API
│   │   ├── sockets/         # WebSocket 핸들러
│   │   ├── game/            # 게임 엔진(엔진/AI/통계/플로우)
│   │   └── util/            # 로거, 코드 생성기
│   ├── test/                # 단위/회귀 테스트(node:test)
│   ├── scripts/             # E2E/관리자 시나리오 스크립트
│   └── migrations/          # 향후 SQLite 전환 시 사용할 SQL
├── client/                  # React + Vite + Tailwind
│   ├── src/
│   │   ├── App.jsx
│   │   ├── pages/           # Home, Admin, Join, Lobby, Play, Results, AdminTeam
│   │   ├── components/
│   │   ├── hooks/
│   │   └── lib/             # API/소켓 클라이언트
│   └── index.html
├── Dockerfile               # 멀티스테이지 빌드
├── docker-compose.yml       # 한 줄 실행
└── README.md
```

## 테스트

```bash
cd server
npm test
```

게임 엔진 단위 테스트(16개) + 단일 HTML 버전과의 회귀 테스트(2개) — 총 18개. 모두 외부 의존성 없는 Node 내장 러너 사용.

추가 시나리오 테스트(서버 부팅 후 실행):

```bash
node scripts/e2e_test.js          # 게임플레이 E2E
node scripts/admin_test.js        # 관리자 강제진행/CSV
node scripts/results_test.js      # 결과 비교 API
```

## 트러블슈팅

**`zsh: command not found: npm`** — Node.js 미설치. `https://nodejs.org`에서 LTS 버전 설치하거나 `brew install node`.

**`EADDRINUSE :::3001`** — 다른 프로세스가 포트 점유 중.
```bash
lsof -ti :3001 | xargs kill -9
```

**`Cannot find module @rollup/...`** — 플랫폼별 네이티브 바이너리 누락 (npm 알려진 버그).
```bash
cd client
rm -rf node_modules package-lock.json
npm install
```

**`Cannot GET /` (포트 3001)** — 개발 모드에서는 정상. 클라이언트는 5173 포트.

**다른 컴퓨터에서 접속 불가** — Vite는 기본적으로 LAN 접속을 허용하지만, 안 될 경우 `client/vite.config.js`의 `server` 객체에 `host: '0.0.0.0'` 추가.

## 데이터 영속화 / 백업

`server/data.json` (Docker는 `./data/data.json`)이 모든 세션 상태를 가집니다. 단일 파일이라 백업이 단순:

```bash
cp data.json data.json.backup-$(date +%Y%m%d)
```

## 향후 확장 (메모)

- SQLite 전환(스키마는 `server/migrations/001_init.sql`에 이미 정의)
- HTTPS + Caddy 자동 인증서 (외부 노출 시)
- AI 정책 다양화(MMSE, 단순 패스스루, 강화학습 등)
- 더 많은 시나리오(SARS, 코로나, 명절 수요 등)
- i18n (영어/일본어 등)

## 라이선스 / 학습 출처

원본 게임은 Jay Forrester가 1960년대 MIT Sloan에서 개발. 이 구현은 학습/교육 목적의 자체 구현이며, 핵심 동학 — 4단계 공급사슬, 주문/배송 지연, 채찍효과 — 은 표준 MIT 클래식 룰을 따릅니다.
