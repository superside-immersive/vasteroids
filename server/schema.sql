-- Vasteroids scoreboard schema (Postgres)

CREATE TABLE IF NOT EXISTS scores (
  id text PRIMARY KEY,
  client_submission_id text UNIQUE,
  name varchar(10) NOT NULL,
  score integer NOT NULL CHECK (score >= 0),
  achievement_icon text,
  placeholder boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE scores
  ADD COLUMN IF NOT EXISTS achievement_icon text;

CREATE INDEX IF NOT EXISTS scores_leaderboard_idx
  ON scores (score DESC, created_at ASC, id ASC);
