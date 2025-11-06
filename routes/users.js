const express = require("express");
const pool = require("../db");
const router = express.Router();

// Get all users
router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM users");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add new user
router.post("/", async (req, res) => {
  const { name, email, password_hash, role_id } = req.body;
  try {
    const result = await pool.query(
      "INSERT INTO users (name,email,password_hash,role_id) VALUES ($1,$2,$3,$4) RETURNING *",
      [name, email, password_hash, role_id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;