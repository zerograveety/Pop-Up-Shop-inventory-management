const express = require("express");
const pool = require("../db");
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { roleMiddleware } = require('../middleware/roleMiddleware');

// Protect all sales routes: Manager/Admin only
router.use(authMiddleware, roleMiddleware(['Manager', 'Admin']));

// Get all sales
router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM sales ORDER BY created_at DESC");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Record a sale (Manager/Admin)
router.post("/", async (req, res) => {
  const { product_id, quantity, unit_price, discount, tax, total_amount, method_id, user_id, event_id } = req.body;
  if (!product_id || !quantity || !unit_price) {
    return res.status(400).json({ error: 'product_id, quantity, and unit_price are required' });
  }
  try {
    // Check stock
    const product = await pool.query('SELECT stock_quantity FROM products WHERE product_id = $1', [product_id]);
    if (product.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    if (product.rows[0].stock_quantity < quantity) {
      return res.status(400).json({ error: `Insufficient stock. Available: ${product.rows[0].stock_quantity}` });
    }

    const amount = total_amount ?? ((unit_price * quantity) - (discount || 0) + (tax || 0));

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `INSERT INTO sales (product_id, quantity, unit_price, discount, tax, total_amount, method_id, user_id, event_id, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'Completed') RETURNING *`,
        [product_id, quantity, unit_price, discount || 0, tax || 0, amount, method_id || null, user_id || req.user.id, event_id || null]
      );
      await client.query(
        "UPDATE products SET stock_quantity = stock_quantity - $1 WHERE product_id=$2",
        [quantity, product_id]
      );
      await client.query('COMMIT');
      res.status(201).json(result.rows[0]);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
