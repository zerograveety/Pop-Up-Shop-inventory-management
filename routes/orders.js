const express = require("express");
const router = express.Router();
const pool = require("../db"); // Make sure you have db.js configured with pg Pool
const authMiddleware = require('../middleware/authMiddleware');
// Destructure the exported roleMiddleware function from the RBAC utilities module
const { roleMiddleware } = require('../middleware/roleMiddleware');

// Public unrestricted GET removed; orders now require auth and role-based filtering

// ✅ Get single order by ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("SELECT * FROM customer_orders WHERE order_id = $1", [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error fetching order" });
  }
});

// Unauthenticated order creation removed per RBAC specification

// ✅ Update order payment status (Paid / Failed)
// ✅ Update order payment status (Paid / Failed)
router.put("/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // Expecting "Paid", "Pending" or "Failed"

    // Validate status value
    const validStatuses = ["Pending", "Paid", "Failed"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status value ❌" });
    }

    // Update query
    const result = await pool.query(
      "UPDATE customer_orders SET payment_status = $1 WHERE order_id = $2 RETURNING *",
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Order not found ❌" });
    }

    res.json({
      message: "Order status updated ✅",
      order: result.rows[0],
    });

  } catch (err) {
    console.error("Update error:", err.message);
    res.status(500).json({ error: "Error updating order status ❌" });
  }
});

// Manager-only order creation
router.post('/', authMiddleware, roleMiddleware(['Manager']), async (req,res)=> {
  try {
    const { customer_id, product_id, quantity, unit_price, discount, tax, event_id } = req.body;
    if (!product_id || !quantity || !unit_price) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const total_amount = (unit_price * quantity) - (discount || 0) + (tax || 0);
    const orderResult = await pool.query(
      `INSERT INTO customer_orders 
        (customer_id, product_id, quantity, unit_price, discount, tax, total_amount, payment_status, event_id, created_by) 
       VALUES ($1,$2,$3,$4,$5,$6,$7,'Pending',$8,$9) 
       RETURNING *`,
      [customer_id || null, product_id, quantity, unit_price, discount || 0, tax || 0, total_amount, event_id || null, req.user.id]
    );
    await pool.query(
      'UPDATE products SET stock_quantity = stock_quantity - $1 WHERE product_id = $2',
      [quantity, product_id]
    );
    res.status(201).json({ message: 'Order created by Manager', order: orderResult.rows[0] });
  } catch (err) {
    console.error('Manager create order error:', err);
    res.status(500).json({ error: 'Error creating order' });
  }
});

// List orders with RBAC filtering
router.get('/', authMiddleware, roleMiddleware(['Manager','Admin']), async (req,res)=> {
  try {
    let rows = [];
    if (req.user.role === 'Manager') {
      const result = await pool.query('SELECT * FROM customer_orders WHERE created_by = $1 ORDER BY order_date DESC', [req.user.id]);
      rows = result.rows;
    } else if (req.user.role === 'Admin') {
      const result = await pool.query('SELECT * FROM customer_orders ORDER BY order_date DESC');
      rows = result.rows;
    }
    res.json({ orders: rows });
  } catch (err) {
    console.error('List orders error:', err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Mark an order as Paid (Manager/Admin)
router.put('/:id/pay', authMiddleware, roleMiddleware(['Manager','Admin']), async (req,res)=> {
  try {
    const { id } = req.params;
    const result = await pool.query(
      "UPDATE customer_orders SET payment_status = 'Paid', paid_at = CURRENT_TIMESTAMP WHERE order_id = $1 AND payment_status = 'Pending' RETURNING *",
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