const router = require('express').Router();
const pool = require('../db/pool');
const { authenticate, requireModerator } = require('../middleware/auth');

// GET /api/movies
router.get('/', async (req, res) => {
  const { genre, search, sort = 'rating', page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const conditions = [];
  const values = [];

  if (genre) {
    values.push(genre);
    conditions.push(`g.name = $${values.length}`);
  }

  if (search) {
    values.push(`%${search}%`);
    conditions.push(`(m.title ILIKE $${values.length} OR m.director ILIKE $${values.length})`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const orderMap = {
    rating: 'm.rating DESC NULLS LAST',
    year: 'm.year DESC NULLS LAST',
    title: 'm.title ASC'
  };

  const orderBy = orderMap[sort] || orderMap.rating;

  try {
    const { rows } = await pool.query(
      `SELECT m.movie_id, m.title, g.name AS genre, m.director,
              m.year, m.duration, m.rating, m.stock_count, m.poster_url,
              m.description
       FROM movies m
       LEFT JOIN genres g ON g.genre_id = m.genre_id
       ${where}
       ORDER BY ${orderBy}
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, parseInt(limit), offset]
    );

    res.json(rows);
  } catch (err) {
    console.error('GET /movies error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/movies/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT m.*, g.name AS genre
       FROM movies m
       LEFT JOIN genres g ON g.genre_id = m.genre_id
       WHERE m.movie_id = $1`,
      [req.params.id]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'Movie not found' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('GET /movies/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/movies
// Moderator only
router.post('/', authenticate, requireModerator, async (req, res) => {
  const {
    title,
    genre_id,
    director,
    year,
    duration,
    description,
    poster_url,
    rating,
    stock_count
  } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'title is required' });
  }

  if (stock_count !== undefined && stock_count < 0) {
    return res.status(400).json({ error: 'stock_count cannot be negative' });
  }

  if (rating !== undefined && rating !== null && (rating < 0 || rating > 10)) {
    return res.status(400).json({ error: 'rating must be between 0 and 10' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO movies
       (title, genre_id, director, year, duration, description, poster_url, rating, stock_count)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        title,
        genre_id,
        director,
        year,
        duration,
        description,
        poster_url,
        rating,
        stock_count ?? 0
      ]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('POST /movies error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/movies/:id
// Moderator only
router.put('/:id', authenticate, requireModerator, async (req, res) => {
  if (req.body.stock_count !== undefined && req.body.stock_count < 0) {
    return res.status(400).json({ error: 'stock_count cannot be negative' });
  }

  if (
    req.body.rating !== undefined &&
    req.body.rating !== null &&
    (req.body.rating < 0 || req.body.rating > 10)
  ) {
    return res.status(400).json({ error: 'rating must be between 0 and 10' });
  }

  const fields = [
    'title',
    'genre_id',
    'director',
    'year',
    'duration',
    'description',
    'poster_url',
    'rating',
    'stock_count'
  ];

  const updates = [];
  const values = [];

  fields.forEach((field) => {
    if (req.body[field] !== undefined) {
      values.push(req.body[field]);
      updates.push(`${field} = $${values.length}`);
    }
  });

  if (!updates.length) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  values.push(req.params.id);

  try {
    const { rows } = await pool.query(
      `UPDATE movies
       SET ${updates.join(', ')}
       WHERE movie_id = $${values.length}
       RETURNING *`,
      values
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'Movie not found' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('PUT /movies/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/movies/:id
// Moderator only
router.delete('/:id', authenticate, requireModerator, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `DELETE FROM movies
       WHERE movie_id = $1
       RETURNING movie_id`,
      [req.params.id]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'Movie not found' });
    }

    res.json({
      deleted: true,
      movie_id: rows[0].movie_id
    });
  } catch (err) {
    console.error('DELETE /movies/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
