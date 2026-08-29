const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || ']oz2L*|IkL5*yZ-&A*G.2cLVAYcM;5H0uWwE%d$jE!o';

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    req.user = null;
    next();
  }
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }
  next();
}

module.exports = { authMiddleware, requireAuth, JWT_SECRET };
