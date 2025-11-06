const express = require("express");
const pool = require("../db");
const authMiddleware = require('../middleware/authMiddleware');
const { managerOrAdmin } = require('../middleware/roleMiddleware');
const router = express.Router();

// Public products listing (basic fields)
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products ORDER BY product_id ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('Get products error:', err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Product search (simple LIKE on name/category/description)
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || !q.trim()) {
      return res.json([]);
    }
    const like = `%${q.toLowerCase()}%`;
    const result = await pool.query(
      `SELECT * FROM products 
       WHERE LOWER(product_name) LIKE $1 OR LOWER(category) LIKE $1 OR LOWER(COALESCE(description,'')) LIKE $1
       ORDER BY product_name ASC`,
      [like]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Search products error:', err);
    res.status(500).json({ error: 'Failed to search products' });
  }
});

// Get single product
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM products WHERE product_id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get product error:', err);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// Add new product (Manager/Admin only)
router.post('/', authMiddleware, managerOrAdmin, async (req, res) => {
  const { product_name, category, price, cost_price, stock_quantity, reorder_level, event_id, batch_number, expiry_date, description } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO products 
        (product_name, category, price, cost_price, stock_quantity, reorder_level, event_id, batch_number, expiry_date, description)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [product_name, category, price, cost_price, stock_quantity, reorder_level, event_id, batch_number, expiry_date, description || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create product error:', err);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// Update product (Manager/Admin only)
router.put('/:id', authMiddleware, managerOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { product_name, category, price, cost_price, stock_quantity, reorder_level, batch_number, expiry_date, description } = req.body;
    const result = await pool.query(
      `UPDATE products SET 
         product_name = COALESCE($1, product_name),
         category = COALESCE($2, category),
         price = COALESCE($3, price),
         cost_price = COALESCE($4, cost_price),
         stock_quantity = COALESCE($5, stock_quantity),
         reorder_level = COALESCE($6, reorder_level),
         batch_number = COALESCE($7, batch_number),
         expiry_date = COALESCE($8, expiry_date),
         description = COALESCE($9, description),
         updated_at = CURRENT_TIMESTAMP
       WHERE product_id = $10 RETURNING *`,
      [product_name, category, price, cost_price, stock_quantity, reorder_level, batch_number, expiry_date, description, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update product error:', err);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// Delete product (Manager/Admin only)
router.delete('/:id', authMiddleware, managerOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM products WHERE product_id = $1 RETURNING product_id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json({ message: 'Product deleted', id });
  } catch (err) {
    console.error('Delete product error:', err);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

module.exports = router;