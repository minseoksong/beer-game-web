-- Phase 1 — 기초 스키마
-- 세션, 팀, 플레이어. 게임 진행 상태(state_json, history)는 Phase 2/3에서 확장.

CREATE TABLE IF NOT EXISTS sessions (
  id              TEXT PRIMARY KEY,
  code            TEXT UNIQUE NOT NULL,
  admin_token     TEXT NOT NULL,
  team_count      INTEGER NOT NULL,
  config_json     TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'lobby',
  created_at      INTEGER NOT NULL,
  finished_at     INTEGER
);

CREATE TABLE IF NOT EXISTS teams (
  id              TEXT PRIMARY KEY,
  session_id      TEXT NOT NULL,
  name            TEXT NOT NULL,
  current_week    INTEGER NOT NULL DEFAULT 1,
  state_json      TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_teams_session ON teams(session_id);

CREATE TABLE IF NOT EXISTS players (
  id              TEXT PRIMARY KEY,
  team_id         TEXT NOT NULL,
  role            TEXT NOT NULL,
  display_name    TEXT NOT NULL,
  player_token    TEXT UNIQUE NOT NULL,
  is_ai           INTEGER NOT NULL DEFAULT 0,
  joined_at       INTEGER NOT NULL,
  last_seen_at    INTEGER,
  UNIQUE(team_id, role),
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_players_team ON players(team_id);
