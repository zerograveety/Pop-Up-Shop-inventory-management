const express = require("express");
const pool = require("../db");
const router = express.Router();

// Get all sales
router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM sales");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Record a sale
router.post("/", async (req, res) => {
  const { product_id, quantity, unit_price, discount, tax, total_amount, method_id, user_id, event_id } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO sales (product_id, quantity, unit_price, discount, tax, total_amount, method_id, user_id, event_id, status) 
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'Completed') RETURNING *`,
      [product_id, quantity, unit_price, discount, tax, total_amount, method_id, user_id, event_id]
    );

    // Update stock
    await pool.query("UPDATE products SET stock_quantity = stock_quantity - $1 WHERE product_id=$2", [quantity, product_id]);

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;