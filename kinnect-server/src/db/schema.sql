-- ══════════════════════════════════════════
--  Kinnect Database Schema
--  Run once against your PostgreSQL instance
-- ══════════════════════════════════════════

-- Genres lookup table
CREATE TABLE IF NOT EXISTS genres (
  genre_id   SERIAL PRIMARY KEY,
  name       VARCHAR(60) NOT NULL UNIQUE
);

-- Users
CREATE TABLE IF NOT EXISTS users (
  user_id       SERIAL PRIMARY KEY,
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(20)  NOT NULL DEFAULT 'customer', -- 'customer' | 'moderator'
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Movies catalog
CREATE TABLE IF NOT EXISTS movies (
  movie_id    SERIAL PRIMARY KEY,
  title       VARCHAR(255) NOT NULL,
  genre_id    INT REFERENCES genres(genre_id) ON DELETE SET NULL,
  director    VARCHAR(120),
  year        SMALLINT,
  duration    VARCHAR(20),         -- e.g. '2h 18m'
  description TEXT,
  poster_url  TEXT,               -- S3 URL
  rating      NUMERIC(3,1),
  stock_count INT NOT NULL DEFAULT 0 CHECK (stock_count >= 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Rentals — tracks who rented what and when it expires
CREATE TABLE IF NOT EXISTS rentals (
  rental_id   SERIAL PRIMARY KEY,
  user_id     INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  movie_id    INT NOT NULL REFERENCES movies(movie_id) ON DELETE CASCADE,
  rented_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expiry_date TIMESTAMPTZ NOT NULL,           -- rented_at + 7 days
  returned_at TIMESTAMPTZ,                    -- NULL = still active
  UNIQUE (user_id, movie_id, rented_at)       -- prevent duplicate active rentals
);

-- Watch Parties
CREATE TABLE IF NOT EXISTS parties (
  party_id    SERIAL PRIMARY KEY,
  host_id     INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  movie_id    INT NOT NULL REFERENCES movies(movie_id) ON DELETE CASCADE,
  status      VARCHAR(20) NOT NULL DEFAULT 'waiting', -- 'waiting' | 'playing' | 'ended'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Party members (many-to-many)
CREATE TABLE IF NOT EXISTS party_members (
  party_id    INT NOT NULL REFERENCES parties(party_id) ON DELETE CASCADE,
  user_id     INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (party_id, user_id)
);

-- ── Indexes ──
CREATE INDEX IF NOT EXISTS idx_movies_genre    ON movies(genre_id);
CREATE INDEX IF NOT EXISTS idx_rentals_user    ON rentals(user_id);
CREATE INDEX IF NOT EXISTS idx_rentals_movie   ON rentals(movie_id);
CREATE INDEX IF NOT EXISTS idx_rentals_expiry  ON rentals(expiry_date);
CREATE INDEX IF NOT EXISTS idx_parties_host    ON parties(host_id);
CREATE INDEX IF NOT EXISTS idx_parties_status  ON parties(status);

-- ── Trigger: auto-update movies.updated_at ──
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_movies_updated_at ON movies;
CREATE TRIGGER trg_movies_updated_at
  BEFORE UPDATE ON movies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Seed genres ──
INSERT INTO genres (name) VALUES
  ('Action'),('Drama'),('Comedy'),('Thriller'),
  ('Sci-Fi'),('Horror'),('Romance')
ON CONFLICT DO NOTHING;
