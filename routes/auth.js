const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'change_this_to_a_long_random_string';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Helper: map numeric role_id to canonical role name
const getRoleName = (roleId) => {
  const id = parseInt(roleId);
  if (id === 1) return 'Admin';
  if (id === 2) return 'Manager';
  return 'User';
};

const getRoleId = (roleName) => {
  if (roleName === 'Admin') return 1;
  if (roleName === 'Manager') return 2;
  return 3;
};

// Helper: sign a JWT for a user row
const signToken = (row) => {
  const role = getRoleName(row.role_id);
  return jwt.sign(
    {
      user_id: row.id,
      name: row.name,
      email: row.email,
      role,
      role_id: row.role_id,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

const publicUser = (row) => ({
  id: row.id,
  name: row.name,
  email: row.email,
  role: getRoleName(row.role_id),
  role_id: row.role_id,
});

// User registration
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role_id = 2 } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Please provide a valid email address' });
    }

    if (![1, 2].includes(parseInt(role_id))) {
      return res.status(400).json({ error: 'Invalid role specified. Use 1 for Admin or 2 for Manager' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const inserted = await pool.query(
      `INSERT INTO users (name, email, password, role_id) VALUES ($1,$2,$3,$4) RETURNING *`,
      [name.trim(), email.toLowerCase(), hashedPassword, parseInt(role_id)]
    );

    const newUser = inserted.rows[0];
    const roleName = getRoleName(newUser.role_id);
    const token = signToken(newUser);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: publicUser(newUser),
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error during registration' });
  }
});

// User login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(403).json({ success: false, message: 'Account is deactivated. Contact an administrator.' });
    }

    const stored = user.password || '';
    let isValidPassword = false;

    if (typeof stored === 'string' && stored.startsWith('$2')) {
      try {
        isValidPassword = await bcrypt.compare(password, stored);
      } catch (e) {
        isValidPassword = false;
      }
    } else {
      // Legacy plaintext fallback: hash and persist
      isValidPassword = (password === stored);
      if (isValidPassword) {
        const newHash = await bcrypt.hash(password, 12);
        try {
          await pool.query('UPDATE users SET password = $1 WHERE id = $2', [newHash, user.id]);
        } catch (_) { /* ignore upgrade errors */ }
      }
    }

    if (!isValidPassword) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    try {
      await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
    } catch (_) { /* ignore if last_login column missing */ }

    const roleName = getRoleName(user.role_id);
    const token = signToken(user);

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: publicUser(user),
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error during login' });
  }
});

// Token verification - requires a valid JWT
router.get('/verify', require('../middleware/authMiddleware'), async (req, res) => {
  try {
    res.json({ success: true, user: req.user });
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(500).json({ error: 'Internal server error during token verification' });
  }
});

// Logout (stateless JWT - client clears token)
router.post('/logout', (req, res) => {
  res.json({ success: true, message: 'Logged out successfully' });
});

module.exports = router;
