-- Vasteroids scoreboard schema (Postgres)

CREATE TABLE IF NOT EXISTS scores (
  id text PRIMARY KEY,
  client_submission_id text UNIQUE,
  name varchar(8) NOT NULL,
  score integer NOT NULL CHECK (score >= 0),
  placeholder boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scores_leaderboard_idx
  ON scores (score DESC, created_at ASC, id ASC);
