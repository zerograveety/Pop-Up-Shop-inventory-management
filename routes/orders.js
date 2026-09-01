const express = require("express");
const router = express.Router();
const pool = require("../db");
const authMiddleware = require('../middleware/authMiddleware');
const { roleMiddleware } = require('../middleware/roleMiddleware');

// Protect all order routes: require Manager/Admin
router.use(authMiddleware, roleMiddleware(['Manager', 'Admin']));

// ✅ Get single order by ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("SELECT * FROM orders WHERE id = $1", [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error fetching order" });
  }
});

// ✅ Update order payment status (Paid / Pending / Failed)
router.put("/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ["Pending", "Paid", "Failed"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status value" });
    }

    const result = await pool.query(
      "UPDATE orders SET payment_status = $1 WHERE id = $2 RETURNING *",
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.json({ message: "Order status updated", order: result.rows[0] });
  } catch (err) {
    console.error("Update error:", err.message);
    res.status(500).json({ error: "Error updating order status" });
  }
});

// Manager/Admin-only order creation
router.post('/', async (req, res) => {
  try {
    const { customer_id, product_id, quantity, unit_price, discount, tax, event_id } = req.body;
    if (!product_id || !quantity || !unit_price) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check stock availability
    const product = await pool.query(
      'SELECT stock_quantity FROM products WHERE product_id = $1',
      [product_id]
    );
    if (product.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    if (product.rows[0].stock_quantity < quantity) {
      return res.status(400).json({
        error: `Insufficient stock. Available: ${product.rows[0].stock_quantity}`
      });
    }

    const total_amount = (unit_price * quantity) - (discount || 0) + (tax || 0);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const orderResult = await client.query(
        `INSERT INTO orders
          (customer_id, product_id, quantity, unit_price, discount, tax, total_amount, payment_status, status, event_id, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'Pending','pending',$8,$9)
         RETURNING *`,
        [customer_id || null, product_id, quantity, unit_price, discount || 0, tax || 0, total_amount, event_id || null, req.user.id]
      );
      await client.query(
        'UPDATE products SET stock_quantity = stock_quantity - $1 WHERE product_id = $2',
        [quantity, product_id]
      );
      await client.query('COMMIT');
      res.status(201).json({ message: 'Order created', order: orderResult.rows[0] });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Create order error:', err);
    res.status(500).json({ error: 'Error creating order' });
  }
});

// List orders with RBAC filtering
router.get('/', async (req, res) => {
  try {
    let rows = [];
    if (req.user.role === 'Manager') {
      const result = await pool.query('SELECT * FROM orders WHERE created_by = $1 ORDER BY created_at DESC', [req.user.id]);
      rows = result.rows;
    } else if (req.user.role === 'Admin') {
      const result = await pool.query('SELECT * FROM orders ORDER BY created_at DESC');
      rows = result.rows;
    }
    res.json({ orders: rows });
  } catch (err) {
    console.error('List orders error:', err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Mark an order as Paid (Manager/Admin)
router.put('/:id/pay', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      "UPDATE orders SET payment_status = 'Paid', status = 'paid', paid_at = CURRENT_TIMESTAMP WHERE id = $1 AND payment_status = 'Pending' RETURNING *",
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found or not pending' });
    }
    res.json({ message: 'Payment recorded', order: result.rows[0] });
  } catch (err) {
    console.error('Order pay error:', err);
    res.status(500).json({ error: 'Failed to update payment status' });
  }
});

module.exports = router;
