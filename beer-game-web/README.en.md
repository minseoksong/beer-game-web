# 🍺 Beer Distribution Game — Multi-Team Web Edition

**English** · [한국어](./README.md)

A web multiplayer implementation of the **Beer Distribution Game**, originally developed at MIT Sloan in the 1960s. The instructor creates a session and shares a 6-character code; students join from their own computers or smartphones, take one of four roles (Retailer / Wholesaler / Distributor / Factory), and play together as a team to experience the supply chain bullwhip effect.

Designed for **single-host, single-command** operation so that classes, seminars, and corporate workshops can run it with minimal setup.

## Key features

- 1–20 teams running simultaneously, 4 players per team (empty seats auto-filled by AI)
- **4 AI policies**: Base-Stock / Naive / Conservative / Reactive — for comparing bullwhip dynamics
- **10 customer demand patterns**: step / constant / random / growing / seasonal / pandemic spike / supply shock / holiday / oscillating / double-step
- **5 scenario presets**: MIT Classic / Pandemic / Holiday / Stable / Chaos — apply multiple options at once
- 3 information modes (full / partial / open) — MIT-classic rule plus variants
- Real-time sync (WebSocket) + 30-second auto-advance timer
- Live charts (orders / inventory / backlog / cumulative cost + customer demand baseline)
- Admin dashboard: monitor all teams at a glance, comparison charts, force-advance, CSV export
- Results screen: team ranking, bullwhip comparison bar chart, automatic insights, achievement badges
- **Internationalization**: Korean / English (browser language auto-detection, header toggle)
- **DB options**: default JSON file / optional SQLite (recommended for 50+ teams)

## Quick start

### Docker (recommended — one line)

If Docker is installed:

```bash
cd beer-game-web
docker compose up -d
```

Open `http://localhost:3001/` in your browser.

Students on the same Wi-Fi can use the host's IP (e.g., `http://192.168.0.42:3001/`).

### Development mode (hot reload)

Run server and client separately so code changes are reflected immediately.

**Terminal 1 — server:**
```bash
cd server
npm install
npm run dev
```

**Terminal 2 — client:**
```bash
cd client
npm install
npm run dev
```

Open `http://localhost:5173/` in your browser (the client port).

### Production build (without Docker)

```bash
# Build the client
cd client
npm install && npm run build

# Copy build output to the server's public directory
mkdir -p ../server/public
cp -r dist/* ../server/public/

# Run the server (production mode)
cd ../server
npm install --omit=dev
NODE_ENV=production npm start
```

Open `http://localhost:3001/` (the server port also serves the static files).

## Usage flow

1. **Admin** goes to `/admin`, sets the team count and game rules, and creates a session. A 6-character code is issued.
2. Share the code (or the join URL) with students.
3. **Students** go to `/join`, enter the code → pick a team → pick a role → enter their name → join.
4. Admin clicks **🎮 Start Game**. All empty seats are filled by AI, and every student auto-routes to the game screen.
5. Each week, all 4 players submit their orders → the team auto-advances. If anyone fails to submit within 30 seconds, only that seat is auto-filled by AI.
6. When all weeks finish, players auto-route to the results screen, where they can compare with other teams in the same session.

## Environment variables

See `.env.example`. Common settings for operations:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | HTTP/WebSocket port |
| `NODE_ENV` | `development` | If `production`, static-file serving is enabled |
| `DB_TYPE` | `json` | `json` or `sqlite` (sqlite requires installing better-sqlite3) |
| `DB_PATH` | `./data.json` | DB file path |
| `PUBLIC_DIR` | `./public` | Built-client static-file directory |
| `LOG_LEVEL` | `info` | `trace` / `debug` / `info` / `warn` / `error` |

### Switching to the SQLite backend

The default JSON-file backend works without external dependencies. For 50+ teams or stronger persistence, switch to SQLite:

```bash
cd server
npm install better-sqlite3
DB_TYPE=sqlite DB_PATH=./data.db npm start
```

The schema is migrated automatically. JSON and SQLite share the same interface, so no route/flow code changes. Note that JSON and SQLite use different files, so existing data is not migrated when switching.

### Public HTTPS deployment (Caddy auto-certificate)

If you have a domain and want to expose it over the internet, use `docker-compose.production.yml` — Caddy automatically issues and renews Let's Encrypt certificates.

```bash
# After pointing your DNS A/AAAA record to the server's IP:
DOMAIN=beer-game.example.com docker compose -f docker-compose.production.yml up -d
```

Ports 80 and 443 must be open externally (for the HTTP-01 challenge).

## Project structure

```
beer-game-web/
├── server/                  # Node.js + Express + Socket.io
│   ├── src/
│   │   ├── index.js         # Entry (API + static + sockets)
│   │   ├── db.js            # JSON / SQLite dispatcher
│   │   ├── db/              # Storage adapters
│   │   ├── routes/          # REST API
│   │   ├── sockets/         # WebSocket handlers
│   │   ├── game/            # Game engine (engine / AI / stats / flow)
│   │   └── util/            # Logger, code generators
│   ├── test/                # Unit / regression tests (node:test)
│   ├── scripts/             # E2E / admin scenario scripts
│   └── migrations/          # SQL for SQLite migration
├── client/                  # React + Vite + Tailwind
│   ├── src/
│   │   ├── App.jsx
│   │   ├── pages/           # Home, Admin, Join, Lobby, Play, Results, AdminTeam
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── i18n/            # Korean / English translations
│   │   └── lib/             # API / socket clients
│   └── index.html
├── Dockerfile               # Multi-stage build
├── docker-compose.yml       # One-line run
├── docker-compose.production.yml  # With Caddy auto-HTTPS
├── Caddyfile                # Reverse proxy config
└── README.md / README.en.md
```

## Testing

```bash
cd server
npm test
```

32 unit/regression tests in total — engine invariants, all 4 AI policies, all 10 demand patterns, all 5 scenario presets, plus regression against the standalone HTML version. All using Node's built-in test runner with no external dependencies.

Additional scenario scripts (run after starting the server):

```bash
node scripts/e2e_test.js       # Gameplay end-to-end
node scripts/admin_test.js     # Admin force-advance / CSV
node scripts/results_test.js   # Results comparison API
node scripts/i18n_check.js     # i18n key parity check
```

## Troubleshooting

**`zsh: command not found: npm`** — Node.js not installed. Install the LTS from `https://nodejs.org` or `brew install node`.

**`EADDRINUSE :::3001`** — Another process is using the port.
```bash
lsof -ti :3001 | xargs kill -9
```

**`Cannot find module @rollup/...`** — Platform-specific native binary missing (known npm bug).
```bash
cd client
rm -rf node_modules package-lock.json
npm install
```

**`Cannot GET /` (port 3001)** — Normal in development mode. The client runs on port 5173.

**Cannot connect from another computer** — Vite allows LAN access by default, but if it doesn't work, add `host: '0.0.0.0'` to the `server` object in `client/vite.config.js`.

## Data persistence / backup

`server/data.json` (or `./data/data.json` with Docker) holds all session state. Single-file backup is straightforward:

```bash
cp data.json data.json.backup-$(date +%Y%m%d)
```

## Future extension ideas (notes)

Core features, operations hardening, i18n, SQLite, and HTTPS are all implemented. Potential additions:

- Mobile-optimized PWA (offline support)
- Real-time chat between teammates
- Additional AI policies (MMSE, RL-based, etc.)
- Tournament mode (cumulative ranking across multiple matches)
- More scenarios (real cases like SARS or financial crises)
- Additional languages (Japanese, Chinese, etc.)
- Per-student cumulative statistics / progress tracking

## License / credits

The original game was developed by Jay Forrester at MIT Sloan in the 1960s. This is an independent educational reimplementation for learning/teaching purposes; the core dynamics — 4-stage supply chain, order/shipping delays, the bullwhip effect — follow the standard MIT classic ruleset.
