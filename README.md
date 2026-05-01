# 🍺 Beer Distribution Game

A modern web implementation of the classic **Beer Distribution Game**, originally developed by Jay Forrester at MIT Sloan in the 1960s to teach systems dynamics and supply chain management. This repository contains **two implementations** designed for different teaching contexts: a zero-install single-file version for quick demonstrations, and a full multi-team web application for classroom use.

The game is designed to let students directly experience the **bullwhip effect** — the phenomenon where order signal variability amplifies as it propagates upstream through a supply chain, making the entire system inefficient.

---

## 📂 What's in this repository

### 1️⃣ Single HTML file — [`beer_game.html`](./beer_game.html)

A zero-dependency game that runs by **double-clicking the file**. One person plays all four roles (Retailer / Wholesaler / Distributor / Factory), or has AI fill in any of them. No installation, no server, no build step.

**Best for:** quick demos, individual practice, one-on-one tutoring.

### 2️⃣ Multi-team web app — [`beer-game-web/`](./beer-game-web/)

A full-stack web application where multiple teams play simultaneously, each player connecting from their own computer or smartphone. The instructor creates a session and shares a 6-character code; students join, pick their team and role, and play together in real time.

- **Server:** Node.js + Express + Socket.io + JSON / SQLite storage
- **Client:** React + Vite + Tailwind + Chart.js
- **4 AI policies**: Base-Stock, Naive, Conservative, Reactive
- **10 demand patterns**: from MIT-classic step to pandemic spikes
- **5 scenario presets**: Classic, Pandemic, Holiday, Stable, Chaos
- **Korean / English** UI with browser-language auto-detection
- **One-line Docker deployment** with optional Caddy auto-HTTPS

**Best for:** classroom sessions, seminars, corporate workshops with multiple concurrent teams.

See [`beer-game-web/README.md`](./beer-game-web/README.md) for detailed usage.

---

## 🚀 Quick start

### Try the single-file game

```
Double-click beer_game.html
```

That's it. Opens in your browser, runs entirely client-side.

### Run the multi-team web app

With Docker:

```bash
cd beer-game-web
docker compose up -d
```

Then open `http://localhost:3001/` in your browser.

Without Docker (development mode with hot reload):

```bash
# Terminal 1 — server
cd beer-game-web/server && npm install && npm run dev

# Terminal 2 — client
cd beer-game-web/client && npm install && npm run dev
```

Then open `http://localhost:5173/`.

---

## 🎯 How the game works

```
Customer → [Retailer] → [Wholesaler] → [Distributor] → [Factory]
            ↑           ↑              ↑              ↑
           orders flow upstream, with 2-week order delay + 2-week shipping delay
```

Each tier sees only its immediate neighbours and must decide every week how much to order from upstream. With delays in the system and limited information, even small variations in customer demand get amplified into massive swings at the factory level. Students experience firsthand:

- The cost of **information silos** between supply chain stages
- How **lead time delays** destabilize system dynamics
- The value of **consistent ordering policies** (e.g., base-stock)
- Why real-world solutions like Walmart-P&G's VMI, Dell's build-to-order, and Zara's Quick Response exist

---

## 📈 Sample result (36 weeks, all-AI base-stock policy)

| Tier | Order std dev | Bullwhip amplification | Cumulative cost |
|------|--------------|-----------------------|-----------------|
| Customer demand | 1.26 | 1.00× (baseline) | — |
| Retailer | 10.37 | **8.25×** | $449 |
| Wholesaler | 22.80 | **18.14×** | $2,269 |
| Distributor | 47.18 | **37.53×** | $5,362 |
| Factory | 74.99 | **59.65×** | $5,770 |

The original signal variability of 1.26 is amplified to ~75 at the factory — a **60× amplification**. This is the bullwhip effect made visible.

---

## 🛠 Architecture

The web app is a single Node.js process serving both the API and the built React client, with WebSocket real-time sync via Socket.io. Default storage is a JSON file (zero external dependencies); SQLite is available as an optional backend for larger deployments. Game state is fully managed server-side — clients only render — which prevents cheating and keeps state consistent across reconnects.

For a deeper architectural overview, design rationale, and the original 6-phase development roadmap, see [`PLAN.md`](./PLAN.md).

---

## 🧪 Testing

```bash
cd beer-game-web/server
npm test
```

32 unit and regression tests using Node's built-in test runner — no external test dependencies. Includes:
- Game engine invariants (no negative inventory, monotonic costs, queue stability)
- AI policy behavior across all 4 policies
- All 10 demand patterns sanity-checked
- Regression test against the standalone HTML version (identical output)
- All 5 scenario presets play through to completion

---

## 🌍 Deployment

For local classroom use on a single host, `docker compose up -d` is enough. For public-facing deployments with HTTPS and a custom domain:

```bash
DOMAIN=beer-game.example.com docker compose -f docker-compose.production.yml up -d
```

This brings up the app behind a Caddy reverse proxy with automatic Let's Encrypt SSL certificate provisioning and renewal. See [`beer-game-web/README.md`](./beer-game-web/README.md#https-외부-노출-caddy-자동-인증서) for details.

---

## 📜 Credits and license

The original game was developed at MIT Sloan in the 1960s by Jay Forrester for teaching system dynamics. This implementation is an independent educational reimplementation that follows the standard MIT classic ruleset (4-tier supply chain, 2-week order delay, 2-week shipping delay, starting inventory 12, holding cost $0.5/unit/week, backlog cost $1.0/unit/week, 36-week duration by default — all configurable).

This codebase is released for educational and research use. Feel free to fork, adapt, and use it in your own classes.
