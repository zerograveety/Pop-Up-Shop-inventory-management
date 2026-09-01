const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');
const { managerOrAdmin } = require('../middleware/roleMiddleware');

const router = express.Router();

// Protect all cashier routes: Manager/Admin only (Cashier role was removed)
router.use(authMiddleware, managerOrAdmin);

// Cashier Dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const todaysOrders = await pool.query(
      `SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as total
       FROM orders
       WHERE DATE(created_at) = CURRENT_DATE AND created_by = $1`,
      [req.user.id]
    );

    const recentOrders = await pool.query(
      `SELECT o.id, o.customer_id, o.total_amount, o.created_at, p.product_name, o.quantity
       FROM orders o
       JOIN products p ON o.product_id = p.product_id
       WHERE DATE(o.created_at) = CURRENT_DATE AND o.created_by = $1
       ORDER BY o.created_at DESC
       LIMIT 10`,
      [req.user.id]
    );

    res.json({
      message: 'Cashier dashboard data',
      user: req.user,
      stats: {
        todaysOrderCount: parseInt(todaysOrders.rows[0].count),
        todaysSales: parseFloat(todaysOrders.rows[0].total)
      },
      recentOrders: recentOrders.rows
    });
  } catch (error) {
    console.error('Cashier dashboard error:', error);
    res.status(500).json({ error: 'Failed to load cashier dashboard' });
  }
});

// Create new order - Manager only
router.post('/orders', async (req, res) => {
  if (req.user.role !== 'Manager') {
    return res.status(403).json({ error: 'Only Manager can create orders' });
  }
  try {
    const { customer_id, product_id, quantity, unit_price, discount = 0, tax = 0 } = req.body;

    const product = await pool.query(
      'SELECT product_name, stock_quantity, price FROM products WHERE product_id = $1',
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

    const total_amount = (unit_price * quantity) - discount + tax;

    const orderResult = await pool.query(
      `INSERT INTO orders
       (customer_id, product_id, quantity, unit_price, discount, tax, total_amount, payment_status, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'Pending', 'pending', $8)
       RETURNING *`,
      [customer_id, product_id, quantity, unit_price, discount, tax, total_amount, req.user.id]
    );

    await pool.query(
      'UPDATE products SET stock_quantity = stock_quantity - $1 WHERE product_id = $2',
      [quantity, product_id]
    );

    res.status(201).json({
      message: 'Order created successfully',
      order: orderResult.rows[0]
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// Pending manager orders listing
router.get('/orders/pending', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT o.id, o.customer_id, o.product_id, o.quantity, o.total_amount, o.created_at, o.status,
              p.product_name, u.name as manager_name
       FROM orders o
       JOIN products p ON o.product_id = p.product_id
       JOIN users u ON o.created_by = u.id
       WHERE o.status = 'pending' AND u.role_id = 2
       ORDER BY o.created_at ASC`
    );
    res.json({ orders: result.rows });
  } catch (error) {
    console.error('Pending orders fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch pending orders' });
  }
});

// Get order details
router.get('/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT o.*, p.product_name, u.name as manager_name
       FROM orders o
       JOIN products p ON o.product_id = p.product_id
       LEFT JOIN users u ON o.created_by = u.id
       WHERE o.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({ order: result.rows[0] });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// Mark order as paid (Manager/Admin)
router.put('/orders/:id/pay', async (req, res) => {
  if (req.user.role !== 'Manager') {
    return res.status(403).json({ error: 'Only Manager can record payments' });
  }
  try {
    const { id } = req.params;
    const update = await pool.query(
      `UPDATE orders SET status = 'paid', payment_status = 'Paid', paid_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
      [id]
    );
    if (update.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json({ message: 'Payment recorded', order: update.rows[0] });
  } catch (error) {
    console.error('Mark paid error:', error);
    res.status(500).json({ error: 'Failed to mark order as paid' });
  }
});

// Get daily sales
router.get('/sales/daily', async (req, res) => {
  try {
    const { date = new Date().toISOString().split('T')[0] } = req.query;

    const result = await pool.query(
      `SELECT o.id, o.customer_id, p.product_name, o.quantity, o.unit_price,
              o.discount, o.tax, o.total_amount, o.created_at
       FROM orders o
       JOIN products p ON o.product_id = p.product_id
       WHERE DATE(o.created_at) = $1 AND o.created_by = $2
       ORDER BY o.created_at DESC`,
      [date, req.user.id]
    );

    const summary = await pool.query(
      `SELECT COUNT(*) as total_orders, SUM(total_amount) as total_sales,
              SUM(discount) as total_discounts, SUM(tax) as total_taxes
       FROM orders
       WHERE DATE(created_at) = $1 AND created_by = $2`,
      [date, req.user.id]
    );

    res.json({ date, orders: result.rows, summary: summary.rows[0] });
  } catch (error) {
    console.error('Daily sales error:', error);
    res.status(500).json({ error: 'Failed to fetch daily sales' });
  }
});

// Quick product lookup
router.get('/products/search', async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }

    const result = await pool.query(
      `SELECT product_id, product_name, category, price, stock_quantity
       FROM products
       WHERE (product_name ILIKE $1 OR category ILIKE $1) AND stock_quantity > 0
       ORDER BY product_name
       LIMIT 20`,
      [`%${q}%`]
    );

    res.json({ products: result.rows });
  } catch (error) {
    console.error('Product search error:', error);
    res.status(500).json({ error: 'Failed to search products' });
  }
});

// Process refund (Manager/Admin)
router.post('/orders/:id/refund', async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body || {};
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const order = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [id]);

    if (order.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Order not found' });
    }

    const orderData = order.rows[0];

    // Prevent double refunding
    if (orderData.status === 'refunded') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Order is already refunded' });
    }

    await client.query(
      `INSERT INTO refunds (order_id, amount, reason, processed_by) VALUES ($1, $2, $3, $4)`,
      [id, orderData.total_amount, reason || null, req.user.id]
    );

    await client.query(
      'UPDATE products SET stock_quantity = stock_quantity + $1 WHERE product_id = $2',
      [orderData.quantity, orderData.product_id]
    );

    await client.query(
      "UPDATE orders SET status = 'refunded', payment_status = 'Failed' WHERE id = $1",
      [id]
    );

    await client.query('COMMIT');
    res.json({ message: 'Refund processed successfully', refundAmount: orderData.total_amount });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Process refund error:', error);
    res.status(500).json({ error: 'Failed to process refund' });
  } finally {
    client.release();
  }
});

module.exports = router;
