const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'change_this_to_a_long_random_string';

const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || req.headers['x-access-token'];
    if (!authHeader) {
      return res.status(401).json({ error: 'Authentication required. Please login first.' });
    }

    // Support "Bearer <token>" and raw token formats
    let token = authHeader;
    if (token.startsWith('Bearer ')) {
      token = token.slice(7).trim();
    }

    if (!token) {
      return res.status(401).json({ error: 'Authentication required. Please login first.' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = {
      id: decoded.user_id ?? decoded.id,
      name: decoded.name,
      email: decoded.email,
      role: decoded.role,
      roleId: decoded.role_id ?? (decoded.role === 'Admin' ? 1 : decoded.role === 'Manager' ? 2 : 3)
    };

    return next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired. Please login again.' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token. Please login again.' });
    }
    console.error('Auth middleware error:', error);
    return res.status(500).json({ error: 'Internal server error during authentication.' });
  }
};

module.exports = authMiddleware;
