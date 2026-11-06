-- Снимки старых подборок нужны для истории после смены фильтров.
CREATE TABLE IF NOT EXISTS selection_sessions (
  id uuid PRIMARY KEY,
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(room_id, id)
);
INSERT INTO selection_sessions(id,room_id,snapshot)
SELECT (selection->>'id')::uuid,id,selection FROM rooms WHERE selection IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS votes (
  room_id uuid NOT NULL,
  selection_id uuid NOT NULL,
  -- Участник при выходе удаляется. Его оценка остаётся в истории, но не участвует в новых Match.
  participant_id uuid NOT NULL,
  movie_tmdb_id bigint NOT NULL CHECK(movie_tmdb_id>0),
  choice text NOT NULL CHECK(choice IN ('like','dislike')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(selection_id, participant_id, movie_tmdb_id),
  FOREIGN KEY(room_id,selection_id) REFERENCES selection_sessions(room_id,id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS votes_match_idx ON votes(selection_id,movie_tmdb_id,choice);

CREATE TABLE IF NOT EXISTS matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL,
  selection_id uuid NOT NULL,
  movie_tmdb_id bigint NOT NULL CHECK(movie_tmdb_id>0),
  movie jsonb NOT NULL,
  participants jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(selection_id,movie_tmdb_id),
  FOREIGN KEY(room_id,selection_id) REFERENCES selection_sessions(room_id,id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS matches_room_idx ON matches(room_id,created_at);
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS voting_revision integer NOT NULL DEFAULT 0;
