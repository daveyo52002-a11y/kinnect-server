const router = require('express').Router();
const pool   = require('../db/pool');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// ── GET /api/parties ─────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.party_id, p.status, p.created_at,
              m.movie_id, m.title, m.poster_url,
              u.user_id AS host_id, u.name AS host_name,
              COUNT(pm.user_id) AS member_count
       FROM parties p
       JOIN movies m ON m.movie_id = p.movie_id
       JOIN users  u ON u.user_id  = p.host_id
       LEFT JOIN party_members pm ON pm.party_id = p.party_id
       WHERE p.status IN ('waiting','playing')
       GROUP BY p.party_id, m.movie_id, u.user_id
       ORDER BY p.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /parties error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/parties ────────────────────────────────────────────
// Body: { movie_id }
router.post('/', async (req, res) => {
  const { movie_id } = req.body;
  if (!movie_id) return res.status(400).json({ error: 'movie_id is required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO parties (host_id, movie_id) VALUES ($1, $2) RETURNING *`,
      [req.user.user_id, movie_id]
    );
    const party = rows[0];

    // Host auto-joins
    await client.query(
      `INSERT INTO party_members (party_id, user_id) VALUES ($1, $2)`,
      [party.party_id, req.user.user_id]
    );

    await client.query('COMMIT');
    res.status(201).json(party);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('POST /parties error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// ── POST /api/parties/:id/join ───────────────────────────────────
router.post('/:id/join', async (req, res) => {
  try {
    await pool.query(
      `INSERT INTO party_members (party_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [req.params.id, req.user.user_id]
    );
    res.json({ joined: true });
  } catch (err) {
    console.error('POST /parties/:id/join error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PATCH /api/parties/:id/status ── host only ───────────────────
// Body: { status: 'playing' | 'ended' }
router.patch('/:id/status', async (req, res) => {
  const { status } = req.body;
  if (!['playing','ended'].includes(status)) {
    return res.status(400).json({ error: "status must be 'playing' or 'ended'" });
  }

  try {
    const { rows } = await pool.query(
      `UPDATE parties SET status = $1
       WHERE party_id = $2 AND host_id = $3
       RETURNING *`,
      [status, req.params.id, req.user.user_id]
    );
    if (!rows[0]) return res.status(403).json({ error: 'Party not found or not your party' });
    res.json(rows[0]);
  } catch (err) {
    console.error('PATCH /parties/:id/status error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
