const router = require('express').Router();
const pool   = require('../db/pool');
const { authenticate } = require('../middleware/auth');

// All rental routes require authentication
router.use(authenticate);

//GET /api/rentals 
// Returns the current user's rentals
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT r.rental_id, r.rented_at, r.expiry_date, r.returned_at,
              m.movie_id, m.title, m.poster_url, m.duration,
              g.name AS genre
       FROM rentals r
       JOIN movies m ON m.movie_id = r.movie_id
       LEFT JOIN genres g ON g.genre_id = m.genre_id
       WHERE r.user_id = $1
       ORDER BY r.rented_at DESC`,
      [req.user.user_id]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /rentals error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// /api/rentals
// Body: { movie_id }
router.post('/', async (req, res) => {
  const { movie_id } = req.body;
  if (!movie_id) return res.status(400).json({ error: 'movie_id is required' });

  try {
    // Check movie exists and has stock
    const { rows: movieRows } = await pool.query(
      'SELECT movie_id, title, stock_count FROM movies WHERE movie_id = $1',
      [movie_id]
    );
    const movie = movieRows[0];
    if (!movie) return res.status(404).json({ error: 'Movie not found' });
    if (movie.stock_count < 1) return res.status(409).json({ error: 'No copies available' });

    // Check user doesn't already have this movie rented
    const { rows: existing } = await pool.query(
      `SELECT rental_id FROM rentals
       WHERE user_id = $1 AND movie_id = $2
         AND returned_at IS NULL AND expiry_date > NOW()`,
      [req.user.user_id, movie_id]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: 'You already have an active rental for this movie' });
    }

    // Decrement stock
    await pool.query(
      'UPDATE movies SET stock_count = stock_count - 1 WHERE movie_id = $1',
      [movie_id]
    );

    // Create rental (7-day window)
    const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const { rows } = await pool.query(
      `INSERT INTO rentals (user_id, movie_id, expiry_date)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [req.user.user_id, movie_id, expiry]
    );

    res.status(201).json({ rental: rows[0], movie: { title: movie.title } });
  } catch (err) {
    console.error('POST /rentals error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

//  /api/rentals/:id/return 
router.post('/:id/return', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE rentals SET returned_at = NOW()
       WHERE rental_id = $1 AND user_id = $2 AND returned_at IS NULL
       RETURNING *`,
      [req.params.id, req.user.user_id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Active rental not found' });

    // Restore stock
    await pool.query(
      'UPDATE movies SET stock_count = stock_count + 1 WHERE movie_id = $1',
      [rows[0].movie_id]
    );

    res.json({ returned: true, rental: rows[0] });
  } catch (err) {
    console.error('POST /rentals/:id/return error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
