const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');
const { managerOrAdmin } = require('../middleware/roleMiddleware');

const router = express.Router();

// Root summary endpoint (helps avoid 404 when hitting base path)
router.get('/', authMiddleware, managerOrAdmin, async (req, res) => {
  try {
    const productCount = await pool.query('SELECT COUNT(*) FROM products');
    res.json({
      message: 'Manager API root',
      products: parseInt(productCount.rows[0].count),
      endpoints: {
        products: '/api/manager/products',
        inventoryReport: '/api/manager/reports/inventory',
        salesReport: '/api/manager/reports/sales'
      }
    });
  } catch (e) {
    res.json({ message: 'Manager API root', error: e.message });
  }
});

// Manager Dashboard - Manager and Admin access
router.get('/dashboard', authMiddleware, managerOrAdmin, async (req, res) => {
  try {
    // Get manager-specific dashboard data
    const productCount = await pool.query('SELECT COUNT(*) FROM products');
    const orderCount = await pool.query('SELECT COUNT(*) FROM orders WHERE DATE(created_at) = CURRENT_DATE');
    const lowStockProducts = await pool.query('SELECT COUNT(*) FROM products WHERE stock_quantity <= reorder_level');
    const todaysSales = await pool.query('SELECT COALESCE(SUM(total_amount), 0) as total FROM orders WHERE DATE(created_at) = CURRENT_DATE');

    // Recent orders
    const recentOrders = await pool.query(`
      SELECT o.id, o.customer_id, o.total_amount, o.created_at, o.status
      FROM orders o
      ORDER BY o.created_at DESC
      LIMIT 10
    `);

    res.json({
      message: 'Manager dashboard data',
      user: req.user,
      stats: {
        totalProducts: parseInt(productCount.rows[0].count),
        todaysOrders: parseInt(orderCount.rows[0].count),
        lowStockCount: parseInt(lowStockProducts.rows[0].count),
        todaysSales: parseFloat(todaysSales.rows[0].total)
      },
      recentOrders: recentOrders.rows
    });

  } catch (error) {
    console.error('Manager dashboard error:', error);
    res.status(500).json({ error: 'Failed to load manager dashboard' });
  }
});

// Product Management - Manager and Admin access
// List products (Manager/Admin) - includes full dataset
router.get('/products', authMiddleware, managerOrAdmin, async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM products ORDER BY product_id DESC`);
    res.json({ products: result.rows });
  } catch (error) {
    console.error('List products error:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Cache product table column names to avoid repeated information_schema calls
let productColumnsCache = null;
async function getProductColumns() {
  if (productColumnsCache) return productColumnsCache;
  try {
    const { rows } = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'products'`);
    productColumnsCache = rows.map(r => r.column_name.toLowerCase());
  } catch (e) {
    console.warn('Could not introspect products table columns. Falling back to default set.', e.message);
    productColumnsCache = ['product_id','product_name','category','price','cost_price','stock_quantity','reorder_level','batch_number','expiry_date','created_by','updated_at','description'];
  }
  return productColumnsCache;
}

router.post('/products', authMiddleware, managerOrAdmin, async (req, res) => {
  try {
    const cols = await getProductColumns();
    const payload = { ...req.body };

    if (!payload.product_name || payload.price == null) {
      return res.status(400).json({ error: 'product_name and price are required' });
    }

    // Apply defaults only if columns exist
    if (cols.includes('cost_price') && payload.cost_price == null) payload.cost_price = payload.price;
    if (cols.includes('stock_quantity') && payload.stock_quantity == null) payload.stock_quantity = 0;
    if (cols.includes('reorder_level') && payload.reorder_level == null) payload.reorder_level = 0;
    if (cols.includes('category') && payload.category === '') payload.category = null;
    if (cols.includes('batch_number') && payload.batch_number === undefined) payload.batch_number = null;
    if (cols.includes('expiry_date') && payload.expiry_date === undefined) payload.expiry_date = null;
    if (cols.includes('description') && payload.description === undefined) payload.description = null;
    if (cols.includes('created_by')) payload.created_by = req.user.id; // only attach if column exists

    // Build dynamic insert
    const insertableKeys = Object.keys(payload).filter(k => payload[k] !== undefined && cols.includes(k.toLowerCase()));
    const columnList = insertableKeys.join(', ');
    const placeholders = insertableKeys.map((_, i) => `$${i+1}`).join(', ');
    const values = insertableKeys.map(k => payload[k]);

    const { rows } = await pool.query(`INSERT INTO products (${columnList}) VALUES (${placeholders}) RETURNING *`, values);
    res.status(201).json({ message: 'Product created successfully', product: rows[0] });
  } catch (error) {
    console.error('Create product error:', error);
    // Surface root cause to help debugging (still generic if no pg error detail)
    res.status(500).json({ error: 'Failed to create product', detail: error.message });
  }
});

// Update product - Manager and Admin access
router.put('/products/:id', authMiddleware, managerOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const cols = await getProductColumns();

    const existing = await pool.query('SELECT * FROM products WHERE product_id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Prepare update fields from body limited to existing columns (ignore undefined)
    const updates = [];
    const values = [];
    let idx = 1;
    for (const [key, val] of Object.entries(req.body)) {
      if (val !== undefined && cols.includes(key.toLowerCase()) && key !== 'product_id') {
        updates.push(`${key} = $${idx}`);
        values.push(val);
        idx++;
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    // Add automatic timestamp update if column exists
    if (cols.includes('updated_at')) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
    }

    values.push(id);
    const query = `UPDATE products SET ${updates.join(', ')} WHERE product_id = $${values.length} RETURNING *`;
    const { rows } = await pool.query(query, values);

    res.json({ message: 'Product updated successfully', product: rows[0] });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ error: 'Failed to update product', detail: error.message });
  }
});

// Delete product - Manager and Admin access
router.delete('/products/:id', authMiddleware, managerOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM products WHERE product_id = $1 RETURNING product_name',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({
      message: `Product "${result.rows[0].product_name}" deleted successfully`
    });

  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// Inventory reports - Manager and Admin access
router.get('/reports/inventory', authMiddleware, managerOrAdmin, async (req, res) => {
  try {
    // Low stock products
    const lowStock = await pool.query(`
      SELECT product_id, product_name, category, stock_quantity, reorder_level
      FROM products 
      WHERE stock_quantity <= reorder_level
      ORDER BY stock_quantity ASC
    `);

    // Inventory value
    const inventoryValue = await pool.query(`
      SELECT 
        SUM(stock_quantity * cost_price) as total_cost_value,
        SUM(stock_quantity * price) as total_selling_value,
        COUNT(*) as total_products
      FROM products
    `);

    // Category breakdown
    const categoryBreakdown = await pool.query(`
      SELECT 
        category,
        COUNT(*) as product_count,
        SUM(stock_quantity) as total_stock,
        SUM(stock_quantity * price) as category_value
      FROM products
      GROUP BY category
      ORDER BY category_value DESC
    `);

    res.json({
      lowStockProducts: lowStock.rows,
      inventoryValue: inventoryValue.rows[0],
      categoryBreakdown: categoryBreakdown.rows
    });

  } catch (error) {
    console.error('Inventory report error:', error);
    res.status(500).json({ error: 'Failed to generate inventory report' });
  }
});

// Sales reports - Manager and Admin access
router.get('/reports/sales', authMiddleware, managerOrAdmin, async (req, res) => {
  try {
    const { period = 'today' } = req.query;
    
    let dateFilter = "DATE(created_at) = CURRENT_DATE";
    if (period === 'week') {
      dateFilter = "created_at >= CURRENT_DATE - INTERVAL '7 days'";
    } else if (period === 'month') {
      dateFilter = "created_at >= CURRENT_DATE - INTERVAL '30 days'";
    }

    // Sales summary
    const salesSummary = await pool.query(`
      SELECT 
        COUNT(*) as total_orders,
        SUM(total_amount) as total_sales,
        AVG(total_amount) as average_order_value
      FROM orders 
      WHERE ${dateFilter}
    `);

    // Top products
    const topProducts = await pool.query(`
      SELECT 
        p.product_name,
        SUM(o.quantity) as total_sold,
        SUM(o.total_amount) as revenue
      FROM orders o
      JOIN products p ON o.product_id = p.product_id
      WHERE ${dateFilter}
      GROUP BY p.product_id, p.product_name
      ORDER BY total_sold DESC
      LIMIT 10
    `);

    res.json({
      period,
      summary: salesSummary.rows[0],
      topProducts: topProducts.rows
    });

  } catch (error) {
    console.error('Sales report error:', error);
    res.status(500).json({ error: 'Failed to generate sales report' });
  }
});

// ===============================
// Shop stock & stock orders 📦
// ===============================

async function ensureStockSchema() {
  try {
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
  } catch (e) {
    console.warn('ensureStockSchema(manager) warning:', e.message);
  }
}

async function getAssignedEventId(userId) {
  const r = await pool.query('SELECT event_id FROM user_event_assignments WHERE user_id = $1', [userId]);
  return r.rows[0]?.event_id || null;
}

// Manager: view stock for their assigned shop
router.get('/shop/stock', authMiddleware, managerOrAdmin, async (req, res) => {
  try {
    const userId = req.user.id;
    const eventId = await getAssignedEventId(userId);
    if (!eventId) return res.status(400).json({ error: 'No shop assigned to this manager' });
    const q = `
      SELECT p.product_id, p.product_name, p.category, p.price, p.cost_price,
             COALESCE(s.quantity, 0) AS quantity
      FROM products p
      LEFT JOIN shop_stock s ON s.product_id = p.product_id AND s.event_id = $1
      ORDER BY p.product_id ASC
    `;
    const { rows } = await pool.query(q, [eventId]);
    res.json({ event_id: eventId, stock: rows });
  } catch (error) {
    console.error('Manager shop stock error:', error);
    res.status(500).json({ error: 'Failed to load shop stock' });
  }
});

// Manager: adjust own shop stock (absolute quantity or delta)
// Body: { quantity?: number, delta?: number }
router.put('/shop/stock/:productId', authMiddleware, managerOrAdmin, async (req, res) => {
  try {
    await ensureStockSchema();
    const userId = req.user.id;
    const eventId = await getAssignedEventId(userId);
    if (!eventId) return res.status(400).json({ error: 'No shop assigned to this manager' });
    const { productId } = req.params;
    const { quantity, delta } = req.body || {};

    // Ensure product exists
    const prod = await pool.query('SELECT product_id FROM products WHERE product_id = $1', [productId]);
    if (prod.rowCount === 0) return res.status(404).json({ error: 'Product not found' });

    if (quantity != null) {
      const { rows } = await pool.query(
        `INSERT INTO shop_stock (event_id, product_id, quantity)
         VALUES ($1, $2, $3)
         ON CONFLICT (event_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = CURRENT_TIMESTAMP
         RETURNING event_id, product_id, quantity`,
        [eventId, productId, Math.max(0, parseInt(quantity))]
      );
      return res.json({ message: 'Shop quantity set', stock: rows[0] });
    }

    if (delta != null) {
      const { rows } = await pool.query(
        `INSERT INTO shop_stock (event_id, product_id, quantity)
         VALUES ($1, $2, GREATEST(0, $3))
         ON CONFLICT (event_id, product_id) DO UPDATE SET quantity = GREATEST(0, shop_stock.quantity + $3), updated_at = CURRENT_TIMESTAMP
         RETURNING event_id, product_id, quantity`,
        [eventId, productId, parseInt(delta)]
      );
      return res.json({ message: 'Shop quantity adjusted', stock: rows[0] });
    }

    return res.status(400).json({ error: 'Provide quantity or delta' });
  } catch (error) {
    console.error('Adjust shop stock error:', error);
    res.status(500).json({ error: 'Failed to adjust shop stock' });
  }
});

// Manager: create stock order for their shop
router.post('/stock-orders', authMiddleware, managerOrAdmin, async (req, res) => {
  try {
    await ensureStockSchema();
    const userId = req.user.id;
    const eventId = await getAssignedEventId(userId);
    if (!eventId) return res.status(400).json({ error: 'No shop assigned to this manager' });

    const { items, note } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Provide items: [{product_id, quantity}]' });
    }
    // Basic validation
    for (const it of items) {
      if (!it.product_id || !it.quantity || it.quantity <= 0) {
        return res.status(400).json({ error: 'Each item requires product_id and positive quantity' });
      }
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const o = await client.query(
        `INSERT INTO stock_orders (event_id, user_id, status, note) VALUES ($1,$2,'requested',$3) RETURNING *`,
        [eventId, userId, note || null]
      );
      const orderId = o.rows[0].id;
      for (const it of items) {
        await client.query(
          `INSERT INTO stock_order_items (order_id, product_id, quantity) VALUES ($1,$2,$3)`,
          [orderId, it.product_id, parseInt(it.quantity)]
        );
      }
      await client.query('COMMIT');
      res.status(201).json({ message: 'Stock order created', order: { ...o.rows[0], items } });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Create stock order error:', error);
    res.status(500).json({ error: 'Failed to create stock order' });
  }
});

// Manager: list own stock orders
router.get('/stock-orders', authMiddleware, managerOrAdmin, async (req, res) => {
  try {
    await ensureStockSchema();
    const userId = req.user.id;
    const orders = await pool.query(
      `SELECT o.*, e.event_name FROM stock_orders o
       LEFT JOIN popup_events e ON e.event_id = o.event_id
       WHERE o.user_id = $1 ORDER BY o.created_at DESC`,
      [userId]
    );
    const items = await pool.query(
      `SELECT i.*, p.product_name FROM stock_order_items i
       JOIN products p ON p.product_id = i.product_id
       WHERE i.order_id = ANY($1::int[])`,
      [orders.rows.map(r => r.id)]
    );
    const byOrder = items.rows.reduce((acc, it) => {
      (acc[it.order_id] = acc[it.order_id] || []).push(it);
      return acc;
    }, {});
    res.json({ orders: orders.rows.map(o => ({ ...o, items: byOrder[o.id] || [] })) });
  } catch (error) {
    console.error('List own stock orders error:', error);
    res.status(500).json({ error: 'Failed to load stock orders' });
  }
});

// Manager: combined view of warehouse vs. shop stock for all products
router.get('/stock/combined', authMiddleware, managerOrAdmin, async (req, res) => {
  try {
    await ensureStockSchema();
    const userId = req.user.id;
    const eventId = await getAssignedEventId(userId);
    if (!eventId) return res.status(400).json({ error: 'No shop assigned to this manager' });

    const q = `
      SELECT 
        p.product_id,
        p.product_name,
        p.category,
        p.price,
        p.cost_price,
        COALESCE(w.quantity, p.stock_quantity, 0) AS warehouse_quantity,
        COALESCE(s.quantity, 0) AS shop_quantity
      FROM products p
      LEFT JOIN warehouse_stock w ON w.product_id = p.product_id
      LEFT JOIN shop_stock s ON s.product_id = p.product_id AND s.event_id = $1
      ORDER BY p.product_name ASC
    `;
    const { rows } = await pool.query(q, [eventId]);
    res.json({ event_id: eventId, products: rows });
  } catch (error) {
    console.error('Manager combined stock error:', error);
    res.status(500).json({ error: 'Failed to load combined stock' });
  }
});
// Low stock alerts for manager's shop
router.get('/alerts/low-stock', authMiddleware, managerOrAdmin, async (req, res) => {
  try {
    const userId = req.user.id;
    const eventId = await getAssignedEventId(userId);
    if (!eventId) return res.status(400).json({ error: 'No shop assigned to this manager' });

    // Show CURRENT low-stock items only (qty < 5), but annotate with last trigger alert time if any.
    // This avoids stale alerts after restocking.
    const { rows } = await pool.query(
      `SELECT p.product_id,
              p.product_name,
              COALESCE(s.quantity,0) AS quantity,
              (
                SELECT MAX(created_at)
                FROM low_stock_alerts a
                WHERE a.source='shop' AND a.event_id = $1 AND a.product_id = p.product_id
              ) AS last_alert_at
       FROM products p
       LEFT JOIN shop_stock s ON s.product_id = p.product_id AND s.event_id = $1
       WHERE COALESCE(s.quantity,0) < 5
       ORDER BY p.product_name ASC
       LIMIT 100`,
      [eventId]
    );

    const alerts = rows.map(r => ({
      id: null,
      created_at: r.last_alert_at,
      source: 'shop',
      event_id: eventId,
      product_id: r.product_id,
      product_name: r.product_name,
      quantity: r.quantity,
      threshold: 5
    }));

    res.json({ event_id: eventId, alerts });
  } catch (error) {
    console.error('Manager low-stock alerts error:', error);
    res.status(500).json({ error: 'Failed to load low-stock alerts' });
  }
});

module.exports = router;