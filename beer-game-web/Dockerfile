# 멀티스테이지 빌드 — 클라이언트는 한 번만 빌드, 서버 이미지에 정적 파일 포함
# `docker build -t beer-game .` 한 줄로 빌드 가능.

# ─────────────────────────────────────────────────────────────
# Stage 1: 클라이언트 빌드 (Vite → /app/client/dist)
# ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS client-build
WORKDIR /app/client
COPY client/package.json client/package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY client ./
RUN npm run build

# ─────────────────────────────────────────────────────────────
# Stage 2: 서버 + 빌드된 클라이언트 정적 파일
# ─────────────────────────────────────────────────────────────
FROM node:22-alpine
WORKDIR /app

# 서버 의존성만 설치 (dev deps 제외)
COPY server/package.json server/package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund

# 서버 소스
COPY server/src ./src
COPY server/migrations ./migrations

# 클라이언트 빌드 산출물을 /app/public으로
COPY --from=client-build /app/client/dist ./public

# 데이터 디렉토리 (data.json 영속화)
RUN mkdir -p /data
ENV DB_PATH=/data/data.json
ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

# 컨테이너 헬스체크
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/health || exit 1

CMD ["node", "src/index.js"]
