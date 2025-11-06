const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../db');

const router = express.Router();

// JWT removed: authentication now returns user objects only

// Helper: map numeric role_id to canonical role name
const getRoleName = (roleId) => {
  const id = parseInt(roleId);
  if (id === 1) return 'Admin';
  if (id === 2) return 'Manager';
  return 'User';
};

// Helper: normalize a raw user row to unified shape regardless of column naming differences
const normalizeUserRow = (row) => {
  // Support either legacy: id,password OR updated: user_id,password_hash
  const userId = row.user_id ?? row.id;
  const passwordHash = row.password_hash ?? row.password; // DO NOT re-hash plain text; assume DB already stores hashed values
  return {
    _raw: row,
    user_id: userId,
    name: row.name,
    email: row.email,
    role_id: row.role_id,
    password_hash: passwordHash
  };
};

// User registration
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role_id = 2 } = req.body; // Default to Manager (2)

    // Basic validation
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Please provide a valid email address' });
    }

    // Role validation (only Admin or Manager)
    if (![1, 2].includes(parseInt(role_id))) {
      return res.status(400).json({ error: 'Invalid role specified. Use 1 for Admin or 2 for Manager' });
    }

    // Password validation
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // Check if user already exists (support id or user_id naming)
    const existingUser = await pool.query('SELECT user_id, id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Insert new user using your existing table structure
    // Try insert with password_hash first; if it fails due to column, fallback to password
    let inserted;
    try {
      inserted = await pool.query(
        `INSERT INTO users (name, email, password_hash, role_id) VALUES ($1,$2,$3,$4) RETURNING *`,
        [name.trim(), email.toLowerCase(), hashedPassword, parseInt(role_id)]
      );
    } catch (e) {
      // Fallback if schema uses 'password'
      if (e.message && /password_hash/.test(e.message)) {
        inserted = await pool.query(
          `INSERT INTO users (name, email, password, role_id) VALUES ($1,$2,$3,$4) RETURNING *`,
          [name.trim(), email.toLowerCase(), hashedPassword, parseInt(role_id)]
        );
      } else {
        throw e;
      }
    }
    const result = inserted;

    const newUser = normalizeUserRow(result.rows[0]);
    const roleName = getRoleName(newUser.role_id);

    // Return success response (no JWT)
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: {
        id: newUser.user_id,
        name: newUser.name,
        email: newUser.email,
        role: roleName
      }
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

    // Validation
    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Email and password are required' 
      });
    }

    // Find user by email using your existing table structure
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid email or password' 
      });
    }

    const user = normalizeUserRow(result.rows[0]);

    // Check password using the password_hash column from your table
    let isValidPassword = false;
    const stored = user.password_hash || '';
    const looksHashed = typeof stored === 'string' && stored.startsWith('$2');
    try {
      if (looksHashed) {
        isValidPassword = await bcrypt.compare(password, stored);
      } else {
        // Fallback for legacy rows that stored plaintext or non-bcrypt values
        isValidPassword = (password === stored);
        if (isValidPassword) {
          // Upgrade path: hash the plaintext now and save back (prefer password_hash column)
          const newHash = await bcrypt.hash(password, 12);
          try {
            await pool.query('UPDATE users SET password_hash = $1 WHERE user_id = $2 OR id = $2', [newHash, user.user_id]);
          } catch (e1) {
            // Fallback to updating password column if password_hash not present
            try {
              await pool.query('UPDATE users SET password = $1 WHERE user_id = $2 OR id = $2', [newHash, user.user_id]);
            } catch (_e2) {
              // ignore; login proceeds but password won't be upgraded
            }
          }
        }
      }
    } catch (cmpErr) {
      isValidPassword = false;
    }

    if (!isValidPassword) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid email or password' 
      });
    }

    const roleName = getRoleName(user.role_id);

    // Update last_login if the column is present; detect presence once per process
    try {
      if (global.__LAST_LOGIN_COLUMN_EXISTS === undefined) {
        const colCheck = await pool.query(`
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'users' AND column_name = 'last_login' LIMIT 1
        `);
        global.__LAST_LOGIN_COLUMN_EXISTS = colCheck.rowCount > 0;
        if (!global.__LAST_LOGIN_COLUMN_EXISTS && !global.__LAST_LOGIN_MISSING_LOGGED) {
          console.log('Note: last_login column not found in users table (suppressing further notices).');
          global.__LAST_LOGIN_MISSING_LOGGED = true;
        }
      }
      if (global.__LAST_LOGIN_COLUMN_EXISTS) {
        const idParam = user.user_id || user.id; // fallback if normalized differently
        if (idParam) {
          await pool.query(
            'UPDATE users SET last_login = NOW() WHERE user_id = $1 OR id = $1',
            [idParam]
          );
        }
      }
    } catch (updateError) {
      // Fail silently; we've already cached existence or logged once.
    }

    // Return user without JWT
    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.user_id,
        name: user.name,
        email: user.email,
        role: roleName
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      error: 'Internal server error during login' 
    });
  }
});

// Token verification
router.get('/verify', async (req, res) => {
  try {
    // Simple verify endpoint: if client provides X-User header return it, otherwise return a default dev user
    const xUserHeader = req.headers['x-user'];
    if (xUserHeader) {
      try {
        const parsed = JSON.parse(xUserHeader);
        return res.json({
          success: true,
          user: {
            id: parsed.id || parsed.user_id || 9999,
            name: parsed.name || 'Dev User',
            email: parsed.email || 'dev@example.com',
            role: parsed.role || 'Manager'
          }
        });
      } catch (e) {
        // fall through and return default
      }
    }

    // Default reply (no JWT): return a dev Manager user
    res.json({
      success: true,
      user: { id: 9999, name: 'Dev User', email: 'dev@example.com', role: 'Manager' }
    });

  } catch (error) {
    console.error('Token verification error:', error);
    res.status(500).json({ 
      error: 'Internal server error during token verification' 
    });
  }
});

// Logout (client-side token removal)
router.post('/logout', (req, res) => {
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

module.exports = router;