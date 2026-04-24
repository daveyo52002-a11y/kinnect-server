-- =========================
-- MOVIES (Catalog)
-- =========================

-- Get all movies
SELECT 
  movies.movie_id,
  movies.title,
  genres.name AS genre,
  movies.director,
  movies.year,
  movies.duration,
  movies.description,
  movies.poster_url,
  movies.rating,
  movies.stock_count
FROM movies
LEFT JOIN genres ON movies.genre_id = genres.genre_id;

-- Get a specific movie by ID
SELECT 
  movies.movie_id,
  movies.title,
  genres.name AS genre,
  movies.director,
  movies.year,
  movies.duration,
  movies.description,
  movies.poster_url,
  movies.rating,
  movies.stock_count
FROM movies
LEFT JOIN genres ON movies.genre_id = genres.genre_id
WHERE movies.movie_id = $1;


-- =========================
-- ADMIN (Movie Management)
-- =========================

-- Add a new movie
INSERT INTO movies (title, genre_id, director, year, duration, description, poster_url, rating, stock_count)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);

-- Update movie details
UPDATE movies
SET title = $1,
    genre_id = $2,
    director = $3,
    year = $4,
    duration = $5,
    description = $6,
    poster_url = $7,
    rating = $8,
    stock_count = $9
WHERE movie_id = $10;

-- Delete a movie
DELETE FROM movies
WHERE movie_id = $1;


-- =========================
-- RENTALS
-- =========================

-- Get movie stock before renting
SELECT stock_count
FROM movies
WHERE movie_id = $1;

-- Rent a movie
INSERT INTO rentals (user_id, movie_id, expiry_date)
VALUES ($1, $2, NOW() + INTERVAL '7 days');

-- Decrease stock when rented
UPDATE movies
SET stock_count = stock_count - 1
WHERE movie_id = $1
AND stock_count > 0;

-- Get rentals for a specific user
SELECT 
  rentals.rental_id,
  movies.title,
  rentals.rented_at,
  rentals.expiry_date,
  rentals.returned_at
FROM rentals
JOIN movies ON rentals.movie_id = movies.movie_id
WHERE rentals.user_id = $1;

-- Return a movie
UPDATE rentals
SET returned_at = NOW()
WHERE rental_id = $1;

-- Increase stock when returned
UPDATE movies
SET stock_count = stock_count + 1
WHERE movie_id = $1;


-- =========================
-- WATCH PARTIES
-- =========================

-- Create a watch party
INSERT INTO parties (host_id, movie_id, status)
VALUES ($1, $2, 'waiting');

-- Join a watch party
INSERT INTO party_members (party_id, user_id)
VALUES ($1, $2);

-- Get all active/waiting parties
SELECT 
  parties.party_id,
  users.name AS host_name,
  movies.title AS movie_title,
  parties.status,
  parties.created_at
FROM parties
JOIN users ON parties.host_id = users.user_id
JOIN movies ON parties.movie_id = movies.movie_id
WHERE parties.status IN ('waiting', 'playing');