const jwt = require('jsonwebtoken');

/**
 * Verifies the JWT from the Authorization header.
 * Attaches { user_id, email, role } to req.user on success.
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed token' });
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Only allows moderators through.
 * Must be used AFTER authenticate.
 */
function requireModerator(req, res, next) {
  if (req.user?.role !== 'moderator') {
    return res.status(403).json({ error: 'Moderator access required' });
  }
  next();
}

module.exports = { authenticate, requireModerator };
