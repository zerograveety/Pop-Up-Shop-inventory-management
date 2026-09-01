const express = require("express");
const bcrypt = require("bcrypt");
const pool = require("../db");
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { roleMiddleware } = require('../middleware/roleMiddleware');

// Protect all user management routes: Admin only
router.use(authMiddleware, roleMiddleware(['Admin']));

// Get all users (password hashes excluded)
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, email, role_id, is_active, created_at FROM users ORDER BY id ASC"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add new user (password hashed server-side)
router.post("/", async (req, res) => {
  const { name, email, password, role_id } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }
  const password_hash = await bcrypt.hash(password, 10);
  try {
    const result = await pool.query(
      "INSERT INTO users (name,email,password,role_id) VALUES ($1,$2,$3,$4) RETURNING id, name, email, role_id, created_at",
      [name, email, password_hash, role_id || 2]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
