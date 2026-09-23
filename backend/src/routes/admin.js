// Admin-only routes: dashboard stats, products, categories, orders, activity logs
import { Router } from 'express';
import { query, withTransaction } from '../config/postgres.js';
import { ActivityLog } from '../models/ActivityLog.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { asyncHandler, HttpError, logActivity, requireFields, slugify } from '../utils/helpers.js';
import { getOrderWithItems, restock } from './orders.js';

const router = Router();
router.use(requireAuth, requireAdmin);

// ---------- Dashboard ----------

// GET /api/admin/stats  -> numbers from PostgreSQL + recent events from MongoDB
router.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const [counts, revenue, byStatus, lowStock, recentActivity, topActions] = await Promise.all([
      query(`SELECT
               (SELECT COUNT(*)::int FROM products) AS products,
               (SELECT COUNT(*)::int FROM users WHERE role = 'customer') AS customers,
               (SELECT COUNT(*)::int FROM orders) AS orders`),
      query("SELECT COALESCE(SUM(total), 0) AS revenue FROM orders WHERE status <> 'cancelled'"),
      query('SELECT status, COUNT(*)::int AS count FROM orders GROUP BY status'),
      query('SELECT id, name, stock FROM products WHERE stock <= 5 ORDER BY stock ASC LIMIT 5'),
      ActivityLog.find().sort({ createdAt: -1 }).limit(10).lean(),
      // MongoDB aggregation pipeline: count events per action type
      ActivityLog.aggregate([
        { $group: { _id: '$action', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 8 },
      ]),
    ]);
    res.json({
      ...counts.rows[0],
      revenue: revenue.rows[0].revenue,
      ordersByStatus: byStatus.rows,
      lowStock: lowStock.rows,
      recentActivity,
      topActions: topActions.map((a) => ({ action: a._id, count: a.count })),
    });
  })
);

// GET /api/admin/activity?action=&limit=
router.get(
  '/activity',
  asyncHandler(async (req, res) => {
    const filter = req.query.action ? { action: req.query.action } : {};
    const limit = Math.min(200, Number(req.query.limit) || 50);
    res.json(await ActivityLog.find(filter).sort({ createdAt: -1 }).limit(limit).lean());
  })
);

// ---------- Products ----------

// GET /api/admin/products  -> includes inactive products
router.get(
  '/products',
  asyncHandler(async (_req, res) => {
    const { rows } = await query(
      `SELECT p.*, c.name AS category_name FROM products p
       LEFT JOIN categories c ON c.id = p.category_id ORDER BY p.id DESC`
    );
    res.json(rows);
  })
);

function productValues(body) {
  const price = Number(body.price);
  const stock = Number(body.stock ?? 0);
  if (!(price >= 0)) throw new HttpError(400, 'Price must be a positive number');
  if (!Number.isInteger(stock) || stock < 0) throw new HttpError(400, 'Stock must be a whole number ≥ 0');
  return [
    body.name.trim(),
    slugify(body.slug || body.name),
    body.description || '',
    price,
    stock,
    body.image_url || null,
    body.category_id ? Number(body.category_id) : null,
    body.is_active ?? true,
  ];
}

// POST /api/admin/products
router.post(
  '/products',
  asyncHandler(async (req, res) => {
    requireFields(req.body, ['name', 'price']);
    const { rows } = await query(
      `INSERT INTO products (name, slug, description, price, stock, image_url, category_id, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      productValues(req.body)
    );
    await logActivity(req, 'admin.product_created', { productId: rows[0].id });
    res.status(201).json(rows[0]);
  })
);

// PUT /api/admin/products/:id
router.put(
  '/products/:id',
  asyncHandler(async (req, res) => {
    requireFields(req.body, ['name', 'price']);
    const { rows } = await query(
      `UPDATE products SET name=$1, slug=$2, description=$3, price=$4, stock=$5, image_url=$6,
              category_id=$7, is_active=$8, updated_at=NOW()
       WHERE id=$9 RETURNING *`,
      [...productValues(req.body), Number(req.params.id)]
    );
    if (!rows[0]) throw new HttpError(404, 'Product not found');
    await logActivity(req, 'admin.product_updated', { productId: rows[0].id });
    res.json(rows[0]);
  })
);

// DELETE /api/admin/products/:id
router.delete(
  '/products/:id',
  asyncHandler(async (req, res) => {
    const { rowCount } = await query('DELETE FROM products WHERE id = $1', [Number(req.params.id)]);
    if (!rowCount) throw new HttpError(404, 'Product not found');
    await logActivity(req, 'admin.product_deleted', { productId: Number(req.params.id) });
    res.status(204).end();
  })
);

// ---------- Categories ----------

router.post(
  '/categories',
  asyncHandler(async (req, res) => {
    requireFields(req.body, ['name']);
    const { rows } = await query('INSERT INTO categories (name, slug) VALUES ($1, $2) RETURNING *', [
      req.body.name.trim(),
      slugify(req.body.name),
    ]);
    res.status(201).json(rows[0]);
  })
);

router.put(
  '/categories/:id',
  asyncHandler(async (req, res) => {
    requireFields(req.body, ['name']);
    const { rows } = await query('UPDATE categories SET name=$1, slug=$2 WHERE id=$3 RETURNING *', [
      req.body.name.trim(),
      slugify(req.body.name),
      Number(req.params.id),
    ]);
    if (!rows[0]) throw new HttpError(404, 'Category not found');
    res.json(rows[0]);
  })
);

router.delete(
  '/categories/:id',
  asyncHandler(async (req, res) => {
    const { rowCount } = await query('DELETE FROM categories WHERE id = $1', [Number(req.params.id)]);
    if (!rowCount) throw new HttpError(404, 'Category not found');
    res.status(204).end();
  })
);

// ---------- Orders ----------

// GET /api/admin/orders?status=
router.get(
  '/orders',
  asyncHandler(async (req, res) => {
    const params = [];
    let where = '';
    if (req.query.status) {
      params.push(req.query.status);
      where = 'WHERE o.status = $1';
    }
    const { rows } = await query(
      `SELECT o.id, o.status, o.total, o.created_at, u.name AS customer_name, u.email AS customer_email,
              (SELECT COUNT(*)::int FROM order_items oi WHERE oi.order_id = o.id) AS item_count
       FROM orders o JOIN users u ON u.id = o.user_id ${where}
       ORDER BY o.created_at DESC`,
      params
    );
    res.json(rows);
  })
);

router.get(
  '/orders/:id',
  asyncHandler(async (req, res) => {
    res.json(await getOrderWithItems(Number(req.params.id), req.user));
  })
);

const STATUSES = ['pending', 'paid', 'shipped', 'delivered', 'cancelled'];

// PATCH /api/admin/orders/:id/status  { status }
router.patch(
  '/orders/:id/status',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const { status } = req.body;
    if (!STATUSES.includes(status)) throw new HttpError(400, `Status must be one of: ${STATUSES.join(', ')}`);

    await withTransaction(async (client) => {
      const { rows } = await client.query('SELECT status FROM orders WHERE id = $1 FOR UPDATE', [id]);
      if (!rows[0]) throw new HttpError(404, 'Order not found');
      if (rows[0].status === 'cancelled') throw new HttpError(400, 'Cancelled orders cannot be changed');
      if (status === 'cancelled') await restock(client, id);
      await client.query('UPDATE orders SET status = $1 WHERE id = $2', [status, id]);
    });

    await logActivity(req, 'admin.order_status', { orderId: id, status });
    res.json(await getOrderWithItems(id, req.user));
  })
);

export default router;
