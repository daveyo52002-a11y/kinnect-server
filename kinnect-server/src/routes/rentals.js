const router = require('express').Router();
const pool = require('../db/pool');
const { authenticate, requireModerator } = require('../middleware/auth');

router.use(authenticate);

// GET /api/rentals
// Current user's active rentals
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
         AND r.returned_at IS NULL
         AND r.expiry_date > NOW()
       ORDER BY r.rented_at DESC`,
      [req.user.user_id]
    );

    res.json(rows);
  } catch (err) {
    console.error('GET /rentals error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/rentals/all
// Moderator only: view all rental activity
router.get('/all', requireModerator, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT r.rental_id, r.rented_at, r.expiry_date, r.returned_at,
              u.user_id, u.name AS user_name, u.email,
              m.movie_id, m.title AS movie_title
       FROM rentals r
       JOIN users u ON r.user_id = u.user_id
       JOIN movies m ON r.movie_id = m.movie_id
       ORDER BY r.rented_at DESC`
    );

    res.json(rows);
  } catch (err) {
    console.error('GET /rentals/all error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/rentals
// Body: { movie_id }
router.post('/', async (req, res) => {
  const { movie_id } = req.body;

  if (!movie_id) {
    return res.status(400).json({ error: 'movie_id is required' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { rows: movieRows } = await client.query(
      `SELECT movie_id, title, stock_count
       FROM movies
       WHERE movie_id = $1
       FOR UPDATE`,
      [movie_id]
    );

    const movie = movieRows[0];

    if (!movie) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Movie not found' });
    }

    if (movie.stock_count < 1) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'No copies available' });
    }

    const { rows: activeRentals } = await client.query(
      `SELECT rental_id
       FROM rentals
       WHERE user_id = $1
         AND movie_id = $2
         AND returned_at IS NULL
         AND expiry_date > NOW()`,
      [req.user.user_id, movie_id]
    );

    if (activeRentals.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'You already have an active rental for this movie'
      });
    }

    await client.query(
      `UPDATE movies
       SET stock_count = stock_count - 1
       WHERE movie_id = $1`,
      [movie_id]
    );

    const { rows } = await client.query(
      `INSERT INTO rentals (user_id, movie_id, expiry_date)
       VALUES ($1, $2, NOW() + INTERVAL '7 days')
       RETURNING *`,
      [req.user.user_id, movie_id]
    );

    await client.query('COMMIT');

    res.status(201).json({
      rental: rows[0],
      movie: { title: movie.title }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('POST /rentals error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// POST /api/rentals/:id/return
router.post('/:id/return', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `UPDATE rentals
       SET returned_at = NOW()
       WHERE rental_id = $1
         AND user_id = $2
         AND returned_at IS NULL
       RETURNING *`,
      [req.params.id, req.user.user_id]
    );

    if (!rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Active rental not found' });
    }

    await client.query(
      `UPDATE movies
       SET stock_count = stock_count + 1
       WHERE movie_id = $1`,
      [rows[0].movie_id]
    );

    await client.query('COMMIT');

    res.json({
      returned: true,
      rental: rows[0]
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('POST /rentals/:id/return error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

module.exports = router;
