const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');
const { adminOnly, managerOrAdmin } = require('../middleware/roleMiddleware');

const router = express.Router();

// Helper mapping without relying on roles table (in case it doesn't exist in current DB)
const mapRoleName = (roleId) => {
  switch (parseInt(roleId)) {
    case 1: return 'Admin';
    case 2: return 'Manager';
    default: return 'User';
  }
};

// Admin Dashboard - Only Admin access (no dependency on roles table)
router.get('/dashboard', authMiddleware, adminOnly, async (req, res) => {
  try {
    const userCount = await pool.query('SELECT COUNT(*) FROM users');
    const productCount = await pool.query('SELECT COUNT(*) FROM products');
    const orderCount = await pool.query('SELECT COUNT(*) FROM orders');
    const totalSales = await pool.query('SELECT COALESCE(SUM(total_amount), 0) as total FROM orders');
    const recentUsers = await pool.query(`
      SELECT user_id, name, email, role_id, created_at
      FROM users
      ORDER BY created_at DESC
      LIMIT 5
    `);

    res.json({
      message: 'Admin dashboard data',
      user: req.user,
      stats: {
        totalUsers: parseInt(userCount.rows[0].count),
        totalProducts: parseInt(productCount.rows[0].count),
        totalOrders: parseInt(orderCount.rows[0].count),
        totalSales: parseFloat(totalSales.rows[0].total)
      },
      recentUsers: recentUsers.rows.map(u => ({ ...u, role_name: mapRoleName(u.role_id) }))
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({ error: 'Failed to load admin dashboard' });
  }
});

// User Management - Admin only
router.get('/users', authMiddleware, adminOnly, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT user_id, name, email, role_id, created_at FROM users ORDER BY user_id DESC
    `);
    res.json({ users: result.rows.map(u => ({ ...u, role_name: mapRoleName(u.role_id) })) });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Update user role - Admin only
router.put('/users/:id/role', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { role_id } = req.body;
    if (![1,2].includes(parseInt(role_id))) {
      return res.status(400).json({ error: 'Invalid role specified' });
    }
    const result = await pool.query(
      'UPDATE users SET role_id = $1 WHERE user_id = $2 RETURNING user_id, name, email, role_id',
      [role_id, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({
      message: `User role updated to ${mapRoleName(role_id)}`,
      user: { ...result.rows[0], role_name: mapRoleName(result.rows[0].role_id) }
    });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

// Toggle user active status - Admin only
// Optional: toggle status only if column exists; returning graceful message if not
router.put('/users/:id/toggle-status', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    try {
      const result = await pool.query(
        'UPDATE users SET is_active = NOT is_active WHERE user_id = $1 RETURNING user_id, name, email, is_active',
        [id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      const user = result.rows[0];
      return res.json({
        message: `User ${user.is_active ? 'activated' : 'deactivated'}`,
        user
      });
    } catch (e) {
      // Column likely not present
      return res.status(400).json({ error: 'is_active column not present in users table' });
    }
  } catch (error) {
    console.error('Toggle user status error:', error);
    res.status(500).json({ error: 'Failed to toggle user status' });
  }
});

// Delete user - Admin only
router.delete('/users/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    const result = await pool.query(
      'DELETE FROM users WHERE user_id = $1 RETURNING name, email',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ message: `User ${result.rows[0].name} deleted successfully` });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// System settings - Admin only
router.get('/settings', authMiddleware, adminOnly, async (req, res) => {
  try {
    res.json({
      settings: {
        storeName: 'Pop-Up Shop',
        currency: 'INR',
        taxRate: 18,
        allowRegistration: true,
        maintenanceMode: false
      }
    });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Failed to load settings' });
  }
});

// Create new user (Admin only)
const bcrypt = require('bcrypt');
router.post('/users', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { name, email, password, role_id } = req.body;
    if (!name || !email || !password || !role_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (![1,2].includes(parseInt(role_id))) {
      return res.status(400).json({ error: 'Invalid role specified' });
    }
    const password_hash = await bcrypt.hash(password, 10);
    const existing = await pool.query('SELECT user_id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already exists' });
    }
    const result = await pool.query(
      'INSERT INTO users (name, email, password_hash, role_id) VALUES ($1,$2,$3,$4) RETURNING user_id, name, email, role_id, created_at',
      [name, email, password_hash, role_id]
    );
    res.status(201).json({
      message: 'User created',
      user: { ...result.rows[0], role_name: mapRoleName(result.rows[0].role_id) }
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// --- Popup events & assignments (Admin only)
// Ensure assignments table exists (creates if missing)
async function ensureUserEventTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_event_assignments (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        event_id INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, event_id)
      )
    `);
    // Enforce single owner per event
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS uniq_event_single_owner ON user_event_assignments(event_id)`);
    // Enforce single event per user (manager can own at most one event)
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS uniq_single_event_per_user ON user_event_assignments(user_id)`);
  } catch (e) {
    console.warn('Could not ensure user_event_assignments table:', e.message);
  }
}

// Ensure popup events table exists
async function ensurePopupEventsTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS popup_events (
        event_id SERIAL PRIMARY KEY,
        event_name VARCHAR(255) NOT NULL,
        place VARCHAR(255) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (e) {
    console.warn('Could not ensure popup_events table:', e.message);
  }
}

// Helper: get table columns for dynamic inserts (handles legacy schemas)
async function getTableColumns(tableName) {
  const q = `
    SELECT column_name, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1
  `;
  const r = await pool.query(q, [tableName]);
  return r.rows;
}

// List popup events (normalize schema differences: place vs location)
router.get('/events', authMiddleware, adminOnly, async (req, res) => {
  try {
    await ensurePopupEventsTable();
    const cols = await getTableColumns('popup_events');
    const colSet = new Set(cols.map(c => c.column_name));
    const hasPlace = colSet.has('place');
    const hasLocation = colSet.has('location');
    const hasStart = colSet.has('start_date');
    const hasEnd = colSet.has('end_date');
    const hasCreated = colSet.has('created_at');

    const selectFields = [
      'event_id',
      'event_name'
    ];
    if (hasPlace || hasLocation) {
      const left = hasPlace ? 'place' : 'NULL';
      const right = hasLocation ? 'location' : 'NULL';
      selectFields.push(`COALESCE(${left}, ${right}) as place`);
    } else {
      selectFields.push('NULL as place');
    }
    if (hasStart) selectFields.push('start_date');
    if (hasEnd) selectFields.push('end_date');
    if (hasCreated) selectFields.push('created_at');

    const q = `SELECT ${selectFields.join(', ')} FROM popup_events ORDER BY event_id ASC`;
    const events = await pool.query(q);
    res.json({ events: events.rows });
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// Create a new popup event (Admin only)
router.post('/events', authMiddleware, adminOnly, async (req, res) => {
  try {
    await ensurePopupEventsTable();
    await ensureUserEventTable();
    const { event_name, place, location, assigned_user_ids } = req.body;
    if (!event_name) return res.status(400).json({ error: 'event_name is required' });

    // Build dynamic insert based on existing columns
    const cols = await getTableColumns('popup_events');
    const colSet = new Set(cols.map(c => c.column_name));

    const fields = ['event_name'];
    const values = ['$1'];
    const args = [event_name];

    let idx = 2;
    if (colSet.has('place')) {
      fields.push('place');
      values.push(`$${idx++}`);
      args.push(place ?? location ?? null);
    } else if (colSet.has('location')) {
      fields.push('location');
      values.push(`$${idx++}`);
      args.push(location ?? place ?? null);
    }

    // If start_date/end_date columns exist, set sensible defaults to satisfy NOT NULL
    if (colSet.has('start_date')) {
      fields.push('start_date');
      values.push('NOW()');
    }
    if (colSet.has('end_date')) {
      fields.push('end_date');
      values.push("NOW() + INTERVAL '1 day'");
    }

    const insertSql = `INSERT INTO popup_events (${fields.join(', ')}) VALUES (${values.join(', ')}) RETURNING *`;
    const r = await pool.query(insertSql, args);
    const created = r.rows[0];

    // Optionally assign users if provided (array of user ids)
    if (Array.isArray(assigned_user_ids) && assigned_user_ids.length > 0) {
      const assignments = [];
      for (const uid of assigned_user_ids) {
        try {
          const ins = await pool.query(
            `INSERT INTO user_event_assignments (user_id, event_id) VALUES ($1, $2)
             ON CONFLICT (user_id, event_id) DO NOTHING RETURNING *`,
            [uid, created.event_id]
          );
          if (ins.rows.length) assignments.push(ins.rows[0]);
        } catch (e) {
          // skip problematic assignment but continue
          console.warn('Failed to assign user', uid, 'to event', created.event_id, e.message);
        }
      }
      return res.status(201).json({ message: 'Event created and users assigned', event: created, assignments });
    }

    // Normalize response to always include .place
    const normalized = { 
      ...created, 
      place: created.place ?? created.location ?? null 
    };
    res.status(201).json({ message: 'Event created', event: normalized });
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// Get users assigned to a specific event
router.get('/events/:id/users', authMiddleware, adminOnly, async (req, res) => {
  try {
    await ensureUserEventTable();
    const { id } = req.params; // event id
    const result = await pool.query(
      `SELECT u.user_id, u.name, u.email, u.role_id
       FROM users u
       JOIN user_event_assignments a ON a.user_id = u.user_id
       WHERE a.event_id = $1
       ORDER BY u.user_id ASC`,
      [id]
    );
    res.json({ users: result.rows });
  } catch (error) {
    console.error('Get event users error:', error);
    res.status(500).json({ error: 'Failed to fetch event users' });
  }
});

// Replace users assigned to a specific event
router.put('/events/:id/users', authMiddleware, adminOnly, async (req, res) => {
  try {
    await ensureUserEventTable();
    const { id } = req.params; // event id
    const { user_ids, user_id } = req.body;
    // Accept single user_id or array; enforce max one
    let selection = [];
    if (Array.isArray(user_ids)) selection = user_ids.map(v => parseInt(v)).filter(Boolean);
    if (user_id !== undefined && user_id !== null) selection = [parseInt(user_id)];
    if (selection.length > 1) return res.status(400).json({ error: 'Only one user can be assigned to an event' });

    // Verify event exists
    const ev = await pool.query('SELECT event_id FROM popup_events WHERE event_id = $1', [id]);
    if (ev.rows.length === 0) return res.status(404).json({ error: 'Event not found' });

    // Clear existing assignment for this event
    await pool.query('DELETE FROM user_event_assignments WHERE event_id = $1', [id]);
    // If a user is being assigned, also clear any existing assignment for that user to enforce one-event-per-user
    if (selection.length === 1) {
      await pool.query('DELETE FROM user_event_assignments WHERE user_id = $1', [selection[0]]);
    }
    let assignedId = null;
    if (selection.length === 1) {
      const ins = await pool.query(
        `INSERT INTO user_event_assignments (user_id, event_id) VALUES ($1,$2)
         ON CONFLICT (event_id) DO NOTHING RETURNING user_id`,
        [selection[0], id]
      );
      assignedId = ins.rows[0]?.user_id || null;
    }
    res.json({ message: 'Event owner updated', assigned_user_id: assignedId });
  } catch (error) {
    console.error('Update event users error:', error);
    res.status(500).json({ error: 'Failed to update event users' });
  }
});

// Get events assigned to a user
// Admins can view any; Managers can only view their own
router.get('/users/:id/events', authMiddleware, managerOrAdmin, async (req, res) => {
  try {
    await ensureUserEventTable();
    const { id } = req.params;
    // If not admin, enforce self-only access
    if (req.user?.role !== 'Admin') {
      const requesterId = String(req.user?.id);
      if (String(id) !== requesterId) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }
    const result = await pool.query(
      `SELECT e.* FROM popup_events e
       JOIN user_event_assignments a ON a.event_id = e.event_id
       WHERE a.user_id = $1`,
      [id]
    );
    res.json({ events: result.rows });
  } catch (error) {
    console.error('Get user events error:', error);
    res.status(500).json({ error: 'Failed to fetch user events' });
  }
});

// Assign user to an event (creates assignment)
router.post('/users/:id/events', authMiddleware, adminOnly, async (req, res) => {
  try {
    await ensureUserEventTable();
    const { id } = req.params; // user id
    const { event_id } = req.body;
    if (!event_id) return res.status(400).json({ error: 'event_id is required' });

    // Ensure event exists
  const ev = await pool.query('SELECT event_id FROM popup_events WHERE event_id = $1', [event_id]);
  if (ev.rows.length === 0) return res.status(404).json({ error: 'Event not found' });

    // Reassign: an event can be assigned to only one user and a user can have only one event
    await pool.query('DELETE FROM user_event_assignments WHERE event_id = $1', [event_id]);
    await pool.query('DELETE FROM user_event_assignments WHERE user_id = $1', [id]);
    const inserted = await pool.query(
      `INSERT INTO user_event_assignments (user_id, event_id) VALUES ($1,$2)
       ON CONFLICT (event_id) DO NOTHING RETURNING *`,
      [id, event_id]
    );

    res.status(201).json({ message: 'User assigned to event', assignment: inserted.rows[0] || null });
  } catch (error) {
    console.error('Assign user to event error:', error);
    res.status(500).json({ error: 'Failed to assign user to event' });
  }
});

// Remove assignment
router.delete('/users/:id/events/:eventId', authMiddleware, adminOnly, async (req, res) => {
  try {
    await ensureUserEventTable();
    const { id, eventId } = req.params;
    const result = await pool.query(
      'DELETE FROM user_event_assignments WHERE user_id = $1 AND event_id = $2 RETURNING *',
      [id, eventId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Assignment not found' });
    res.json({ message: 'Assignment removed' });
  } catch (error) {
    console.error('Remove assignment error:', error);
    res.status(500).json({ error: 'Failed to remove assignment' });
  }
});

// =========================
// Warehouse & Shop Stock 🔧
// =========================

async function ensureStockSchema() {
  try {
    await ensurePopupEventsTable();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS warehouse_stock (
        product_id INTEGER PRIMARY KEY REFERENCES products(product_id) ON DELETE CASCADE,
        quantity INTEGER NOT NULL DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS shop_stock (
        event_id INTEGER NOT NULL REFERENCES popup_events(event_id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
        quantity INTEGER NOT NULL DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (event_id, product_id)
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS stock_orders (
        id SERIAL PRIMARY KEY,
        event_id INTEGER REFERENCES popup_events(event_id) ON DELETE SET NULL,
        user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'requested',
        note TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT chk_stock_order_status CHECK (status IN ('requested','approved','rejected','fulfilled','cancelled'))
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS stock_order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES stock_orders(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
        quantity INTEGER NOT NULL CHECK (quantity > 0)
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_shop_stock_event ON shop_stock(event_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_shop_stock_prod ON shop_stock(product_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_stock_orders_status ON stock_orders(status)`);
  } catch (e) {
    console.warn('ensureStockSchema warning:', e.message);
  }
}

// Admin: list warehouse stock (all products with qty)
router.get('/warehouse/stock', authMiddleware, adminOnly, async (req, res) => {
  try {
    await ensureStockSchema();
    const q = `
      SELECT p.product_id, p.product_name, p.category, p.price, p.cost_price,
             COALESCE(w.quantity, p.stock_quantity, 0) AS quantity
      FROM products p
      LEFT JOIN warehouse_stock w ON w.product_id = p.product_id
      ORDER BY p.product_id ASC
    `;
    const { rows } = await pool.query(q);
    res.json({ stock: rows });
  } catch (error) {
    console.error('List warehouse stock error:', error);
    res.status(500).json({ error: 'Failed to load warehouse stock' });
  }
});

// Admin: adjust warehouse stock for a product
// Body accepts either { quantity: number } (set absolute) or { delta: number } (increment/decrement)
router.put('/warehouse/stock/:productId', authMiddleware, adminOnly, async (req, res) => {
  try {
    await ensureStockSchema();
    const { productId } = req.params;
    const { quantity, delta } = req.body || {};

    // Ensure product exists
    const prod = await pool.query('SELECT product_id FROM products WHERE product_id = $1', [productId]);
    if (prod.rowCount === 0) return res.status(404).json({ error: 'Product not found' });

    if (quantity != null) {
      const { rows } = await pool.query(
        `INSERT INTO warehouse_stock (product_id, quantity)
         VALUES ($1, $2)
         ON CONFLICT (product_id) DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = CURRENT_TIMESTAMP
         RETURNING product_id, quantity`,
        [productId, Math.max(0, parseInt(quantity))]
      );
      return res.json({ message: 'Warehouse quantity set', stock: rows[0] });
    }

    if (delta != null) {
      const { rows } = await pool.query(
        `INSERT INTO warehouse_stock (product_id, quantity)
         VALUES ($1, GREATEST(0, $2))
         ON CONFLICT (product_id) DO UPDATE SET quantity = GREATEST(0, warehouse_stock.quantity + $2), updated_at = CURRENT_TIMESTAMP
         RETURNING product_id, quantity`,
        [productId, parseInt(delta)]
      );
      return res.json({ message: 'Warehouse quantity adjusted', stock: rows[0] });
    }

    return res.status(400).json({ error: 'Provide quantity or delta' });
  } catch (error) {
    console.error('Adjust warehouse stock error:', error);
    res.status(500).json({ error: 'Failed to adjust stock' });
  }
});

// Admin: list stock orders (optionally filter by status)
router.get('/stock-orders', authMiddleware, adminOnly, async (req, res) => {
  try {
    await ensureStockSchema();
    const { status } = req.query;
    const where = status ? 'WHERE o.status = $1' : '';
    const params = status ? [status] : [];
    const q = `
      SELECT o.*, e.event_name, u.name AS manager_name
      FROM stock_orders o
      LEFT JOIN popup_events e ON e.event_id = o.event_id
      LEFT JOIN users u ON u.user_id = o.user_id
      ${where}
      ORDER BY o.created_at DESC
    `;
    const orders = await pool.query(q, params);
    const items = await pool.query(`
      SELECT i.*, p.product_name
      FROM stock_order_items i
      JOIN products p ON p.product_id = i.product_id
      WHERE i.order_id = ANY($1::int[])
    `, [orders.rows.map(r => r.id)]);
    const itemsByOrder = items.rows.reduce((acc, it) => {
      (acc[it.order_id] = acc[it.order_id] || []).push(it);
      return acc;
    }, {});
    res.json({ orders: orders.rows.map(o => ({ ...o, items: itemsByOrder[o.id] || [] })) });
  } catch (error) {
    console.error('List stock orders error:', error);
    res.status(500).json({ error: 'Failed to load stock orders' });
  }
});

// Admin: approve a stock order
router.post('/stock-orders/:id/approve', authMiddleware, adminOnly, async (req, res) => {
  try {
    await ensureStockSchema();
    const { id } = req.params;
    const { rowCount, rows } = await pool.query(`UPDATE stock_orders SET status = 'approved', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND status = 'requested' RETURNING *`, [id]);
    if (rowCount === 0) return res.status(400).json({ error: 'Order not found or not in requested state' });
    res.json({ message: 'Order approved', order: rows[0] });
  } catch (error) {
    console.error('Approve stock order error:', error);
    res.status(500).json({ error: 'Failed to approve order' });
  }
});

// Admin: reject a stock order
router.post('/stock-orders/:id/reject', authMiddleware, adminOnly, async (req, res) => {
  try {
    await ensureStockSchema();
    const { id } = req.params;
    const { rowCount, rows } = await pool.query(`UPDATE stock_orders SET status = 'rejected', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND status IN ('requested','approved') RETURNING *`, [id]);
    if (rowCount === 0) return res.status(400).json({ error: 'Order not found or cannot be rejected' });
    res.json({ message: 'Order rejected', order: rows[0] });
  } catch (error) {
    console.error('Reject stock order error:', error);
    res.status(500).json({ error: 'Failed to reject order' });
  }
});

// Admin: fulfill a stock order (moves stock from warehouse to shop)
router.post('/stock-orders/:id/fulfill', authMiddleware, adminOnly, async (req, res) => {
  const client = await pool.connect();
  try {
    await ensureStockSchema();
    const { id } = req.params;
    await client.query('BEGIN');
    const o = await client.query('SELECT * FROM stock_orders WHERE id = $1 FOR UPDATE', [id]);
    if (o.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Order not found' });
    }
    const order = o.rows[0];
    if (!['approved','requested'].includes(order.status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Order cannot be fulfilled from status ${order.status}` });
    }
    const items = await client.query('SELECT * FROM stock_order_items WHERE order_id = $1', [id]);
    if (items.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Order has no items' });
    }
    // Verify availability using COALESCE(warehouse_stock, products.stock_quantity)
    for (const it of items.rows) {
      const r = await client.query(
        `SELECT w.quantity AS wq, p.stock_quantity AS pq
         FROM products p
         LEFT JOIN warehouse_stock w ON w.product_id = p.product_id
         WHERE p.product_id = $1
         FOR UPDATE`,
        [it.product_id]
      );
      const row = r.rows[0] || {};
      const have = (row.wq != null ? parseInt(row.wq) : (row.pq != null ? parseInt(row.pq) : 0));
      if (have < it.quantity) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Insufficient warehouse stock for product ${it.product_id} (need ${it.quantity}, have ${have})` });
      }
    }
    // Deduct and credit: prefer warehouse_stock if exists; otherwise deduct from products.stock_quantity
    for (const it of items.rows) {
      const r = await client.query(
        `SELECT w.quantity AS wq, p.stock_quantity AS pq
         FROM products p
         LEFT JOIN warehouse_stock w ON w.product_id = p.product_id
         WHERE p.product_id = $1
         FOR UPDATE`,
        [it.product_id]
      );
      const row = r.rows[0] || {};
      if (row.wq != null) {
        await client.query(
          `UPDATE warehouse_stock SET quantity = GREATEST(0, quantity - $1), updated_at = CURRENT_TIMESTAMP WHERE product_id = $2`,
          [it.quantity, it.product_id]
        );
      } else if (row.pq != null) {
        await client.query(
          `UPDATE products SET stock_quantity = GREATEST(0, stock_quantity - $1) WHERE product_id = $2`,
          [it.quantity, it.product_id]
        );
      } else {
        // As a last resort, create a warehouse_stock row (should be rare)
        await client.query(
          `INSERT INTO warehouse_stock (product_id, quantity) VALUES ($1, 0)`,
          [it.product_id]
        );
      }
      await client.query(
        `INSERT INTO shop_stock (event_id, product_id, quantity)
         VALUES ($1, $2, $3)
         ON CONFLICT (event_id, product_id) DO UPDATE SET quantity = shop_stock.quantity + EXCLUDED.quantity, updated_at = CURRENT_TIMESTAMP`,
        [order.event_id, it.product_id, it.quantity]
      );
    }
    await client.query(`UPDATE stock_orders SET status = 'fulfilled', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [id]);
    await client.query('COMMIT');
    res.json({ message: 'Order fulfilled' });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Fulfill stock order error:', error);
    res.status(500).json({ error: 'Failed to fulfill order' });
  } finally {
    client.release();
  }
});

module.exports = router;
