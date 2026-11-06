-- Applies to an EXISTING PostgreSQL volume, without touching rooms/participants.
-- TMDB v3: scalar detail fields plus original JSONB payload for forward compatibility.
CREATE TABLE IF NOT EXISTS movies (
  tmdb_id bigint PRIMARY KEY CHECK (tmdb_id > 0),
  imdb_id text,
  title text NOT NULL,
  original_title text,
  original_language varchar(12),
  overview text,
  tagline text,
  homepage text,
  status text,
  release_date date,
  runtime integer CHECK (runtime IS NULL OR runtime >= 0),
  budget bigint CHECK (budget IS NULL OR budget >= 0),
  revenue bigint CHECK (revenue IS NULL OR revenue >= 0),
  adult boolean NOT NULL DEFAULT false,
  video boolean NOT NULL DEFAULT false,
  popularity numeric(14,4),
  vote_average numeric(5,3),
  vote_count integer,
  poster_path text,
  backdrop_path text,
  belongs_to_collection jsonb,
  genres jsonb NOT NULL DEFAULT '[]'::jsonb,
  production_companies jsonb NOT NULL DEFAULT '[]'::jsonb,
  production_countries jsonb NOT NULL DEFAULT '[]'::jsonb,
  spoken_languages jsonb NOT NULL DEFAULT '[]'::jsonb,
  origin_country jsonb NOT NULL DEFAULT '[]'::jsonb,
  videos jsonb,
  watch_providers jsonb,
  raw_tmdb jsonb NOT NULL DEFAULT '{}'::jsonb,
  tmdb_synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tmdb_genres (
  tmdb_id integer PRIMARY KEY,
  name text NOT NULL
);

CREATE TABLE IF NOT EXISTS movie_genres (
  movie_tmdb_id bigint NOT NULL REFERENCES movies(tmdb_id) ON DELETE CASCADE,
  genre_tmdb_id integer NOT NULL REFERENCES tmdb_genres(tmdb_id),
  PRIMARY KEY (movie_tmdb_id, genre_tmdb_id)
);
CREATE INDEX IF NOT EXISTS movies_release_date_idx ON movies(release_date);
CREATE INDEX IF NOT EXISTS movies_rating_idx ON movies(vote_average DESC);
CREATE INDEX IF NOT EXISTS movies_popularity_idx ON movies(popularity DESC);
CREATE INDEX IF NOT EXISTS movie_genres_genre_idx ON movie_genres(genre_tmdb_id, movie_tmdb_id);
CREATE INDEX IF NOT EXISTS movies_raw_tmdb_idx ON movies USING GIN (raw_tmdb);
