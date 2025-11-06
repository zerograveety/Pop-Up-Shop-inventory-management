const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');
const { cashierOrAbove } = require('../middleware/roleMiddleware');

const router = express.Router();

// Cashier Dashboard - All roles can access
router.get('/dashboard', authMiddleware, cashierOrAbove, async (req, res) => {
  try {
    // Get cashier-specific dashboard data
    const todaysOrders = await pool.query(`
      SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as total
      FROM orders 
      WHERE DATE(created_at) = CURRENT_DATE
      ${req.user.role === 'Cashier' ? 'AND created_by = $1' : ''}
    `, req.user.role === 'Cashier' ? [req.user.id] : []);

    const recentOrders = await pool.query(`
      SELECT o.id, o.customer_id, o.total_amount, o.created_at, p.product_name, o.quantity
      FROM orders o
      JOIN products p ON o.product_id = p.product_id
      WHERE DATE(o.created_at) = CURRENT_DATE
      ${req.user.role === 'Cashier' ? 'AND o.created_by = $1' : ''}
      ORDER BY o.created_at DESC
      LIMIT 10
    `, req.user.role === 'Cashier' ? [req.user.id] : []);

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

// Create new order - Manager only (cashier/admin cannot create orders)
router.post('/orders', authMiddleware, cashierOrAbove, async (req, res) => {
  if (req.user.role !== 'Manager') {
    return res.status(403).json({ error: 'Only Manager can create orders' });
  }
  try {
    const { customer_id, product_id, quantity, unit_price, discount = 0, tax = 0 } = req.body;

    // Validate product exists and has sufficient stock
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

    // Create order
    const orderResult = await pool.query(
      `INSERT INTO orders 
       (customer_id, product_id, quantity, unit_price, discount, tax, total_amount, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
       RETURNING *`,
      [customer_id, product_id, quantity, unit_price, discount, tax, total_amount, req.user.id]
    );

    // Update product stock
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

// Get order details - Cashier/Manager/Admin (cashier limited to own created orders)
router.get('/orders/:id', authMiddleware, cashierOrAbove, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT 
        o.*,
        p.product_name,
        u.name as cashier_name
      FROM orders o
      JOIN products p ON o.product_id = p.product_id
      LEFT JOIN users u ON o.created_by = u.id
      WHERE o.id = $1
      ${req.user.role === 'Cashier' ? 'AND o.created_by = $2' : ''}
    `, req.user.role === 'Cashier' ? [id, req.user.id] : [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({ order: result.rows[0] });

  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// Get daily sales for cashier/manager/admin (cashier limited to own)
router.get('/sales/daily', authMiddleware, cashierOrAbove, async (req, res) => {
  try {
    const { date = new Date().toISOString().split('T')[0] } = req.query;

    const result = await pool.query(`
      SELECT 
        o.id,
        o.customer_id,
        p.product_name,
        o.quantity,
        o.unit_price,
        o.discount,
        o.tax,
        o.total_amount,
        o.created_at
      FROM orders o
      JOIN products p ON o.product_id = p.product_id
      WHERE DATE(o.created_at) = $1
      ${req.user.role === 'Cashier' ? 'AND o.created_by = $2' : ''}
      ORDER BY o.created_at DESC
    `, req.user.role === 'Cashier' ? [date, req.user.id] : [date]);

    const summary = await pool.query(`
      SELECT 
        COUNT(*) as total_orders,
        SUM(total_amount) as total_sales,
        SUM(discount) as total_discounts,
        SUM(tax) as total_taxes
      FROM orders
      WHERE DATE(created_at) = $1
      ${req.user.role === 'Cashier' ? 'AND created_by = $2' : ''}
    `, req.user.role === 'Cashier' ? [date, req.user.id] : [date]);

    res.json({
      date,
      orders: result.rows,
      summary: summary.rows[0]
    });

  } catch (error) {
    console.error('Daily sales error:', error);
    res.status(500).json({ error: 'Failed to fetch daily sales' });
  }
});

// Quick product lookup for cashier/manager/admin
router.get('/products/search', authMiddleware, cashierOrAbove, async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }

    const result = await pool.query(`
      SELECT 
        product_id,
        product_name,
        category,
        price,
        stock_quantity
      FROM products 
      WHERE 
        product_name ILIKE $1 
        OR category ILIKE $1
        AND stock_quantity > 0
      ORDER BY product_name
      LIMIT 20
    `, [`%${q}%`]);

    res.json({ products: result.rows });

  } catch (error) {
    console.error('Product search error:', error);
    res.status(500).json({ error: 'Failed to search products' });
  }
});

// Process refund (basic version) - Cashier/Manager/Admin (could restrict further later)
router.post('/orders/:id/refund', authMiddleware, cashierOrAbove, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    // Get order details
    const order = await pool.query(
      'SELECT * FROM orders WHERE id = $1',
      [id]
    );

    if (order.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const orderData = order.rows[0];

    // Create refund record (you might want a separate refunds table)
    await pool.query(
      `INSERT INTO refunds (order_id, amount, reason, processed_by, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [id, orderData.total_amount, reason, req.user.id]
    );

    // Restore product stock
    await pool.query(
      'UPDATE products SET stock_quantity = stock_quantity + $1 WHERE product_id = $2',
      [orderData.quantity, orderData.product_id]
    );

    // Update order status
    await pool.query(
      'UPDATE orders SET status = $1 WHERE id = $2',
      ['refunded', id]
    );

    res.json({
      message: 'Refund processed successfully',
      refundAmount: orderData.total_amount
    });

  } catch (error) {
    console.error('Process refund error:', error);
    res.status(500).json({ error: 'Failed to process refund' });
  }
});

module.exports = router;

// Additional endpoints for cashier operations on manager-created orders
// Pending manager orders listing (cashier can view all manager-created pending orders, manager/admin can view too)
router.get('/orders/pending', authMiddleware, cashierOrAbove, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT o.id, o.customer_id, o.product_id, o.quantity, o.total_amount, o.created_at, o.status,
             p.product_name, u.name as manager_name
      FROM orders o
      JOIN products p ON o.product_id = p.product_id
      JOIN users u ON o.created_by = u.user_id
      WHERE o.status = 'pending' AND u.role_id = 2
      ORDER BY o.created_at ASC
    `);
    res.json({ orders: result.rows });
  } catch (error) {
    console.error('Pending orders fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch pending orders' });
  }
});

// Mark order as paid - Cashier only
router.put('/orders/:id/pay', authMiddleware, cashierOrAbove, async (req, res) => {
  if (req.user.role !== 'Cashier') {
    return res.status(403).json({ error: 'Only Cashier can record payments' });
  }
  try {
    const { id } = req.params;
    const update = await pool.query(
      `UPDATE orders SET status = 'paid', updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
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