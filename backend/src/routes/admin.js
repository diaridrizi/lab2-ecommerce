// Admin-only routes: dashboard stats, products, categories, orders, activity logs
import { Router } from 'express';
import { query, withTransaction } from '../config/postgres.js';
import { ActivityLog } from '../models/ActivityLog.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { asyncHandler, HttpError, logActivity, requireFields, slugify } from '../utils/helpers.js';
import { cancelOrder, getOrderWithItems, ORDER_FLOWS, restock, withFlow } from './orders.js';
import { releasePayment } from '../utils/payment.js';
import { notifyOrderStatus, orderChanged } from '../utils/notify.js';
import { onlineCount } from '../realtime/socket.js';
import { Review } from '../models/Review.js';
import { Subscriber } from '../models/Subscriber.js';
import { Banner } from '../models/Banner.js';

const router = Router();
router.use(requireAuth, requireAdmin);

// ---------- Dashboard ----------

// GET /api/admin/stats  -> numbers from PostgreSQL + recent events from MongoDB
router.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const [counts, revenue, byStatus, lowStock, recentActivity, topActions, byPayment, mongoCounts] = await Promise.all([
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
      query(`SELECT payment_method, COUNT(*)::int AS count, COALESCE(SUM(total), 0) AS total
             FROM orders WHERE status <> 'cancelled' GROUP BY payment_method ORDER BY payment_method`),
      Promise.all([
        Review.countDocuments(),
        Subscriber.countDocuments({ status: 'subscribed' }),
        Banner.countDocuments({ isActive: true }),
      ]),
    ]);
    res.json({
      ...counts.rows[0],
      revenue: revenue.rows[0].revenue,
      ordersByStatus: byStatus.rows,
      ordersByPayment: byPayment.rows,
      reviews: mongoCounts[0],
      subscribers: mongoCounts[1],
      activeBanners: mongoCounts[2],
      onlineUsers: await onlineCount(), // users connected over WebSockets right now
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
      `SELECT p.*, c.name AS category_name,
              COALESCE((SELECT json_agg(json_build_object('size', s.size, 'stock', s.stock) ORDER BY s.sort_order, s.id)
                        FROM product_sizes s WHERE s.product_id = p.id), '[]') AS sizes
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id ORDER BY p.id DESC`
    );
    res.json(rows);
  })
);

// body.sizes = [{ size: '42', stock: 3 }, ...]  (undefined = leave sizes unchanged, [] = one size)
function parseSizes(sizes) {
  if (sizes === undefined) return undefined;
  if (!Array.isArray(sizes)) throw new HttpError(400, 'Sizes must be a list');
  const seen = new Set();
  return sizes.map((s) => {
    const size = String(s.size ?? '').trim();
    const stock = Number(s.stock ?? 0);
    if (!size) throw new HttpError(400, 'Every size needs a name');
    if (seen.has(size)) throw new HttpError(400, `Size ${size} is listed twice`);
    if (!Number.isInteger(stock) || stock < 0) throw new HttpError(400, `Stock for size ${size} must be a whole number ≥ 0`);
    seen.add(size);
    return { size, stock };
  });
}

// Replaces all sizes of a product (inside the same transaction as the product save)
async function saveSizes(client, productId, sizes) {
  await client.query('DELETE FROM product_sizes WHERE product_id = $1', [productId]);
  for (const [i, s] of sizes.entries()) {
    await client.query('INSERT INTO product_sizes (product_id, size, stock, sort_order) VALUES ($1, $2, $3, $4)', [
      productId, s.size, s.stock, i,
    ]);
  }
}

function productValues(body, sizes) {
  const price = Number(body.price);
  // Sized products: total stock = sum of the sizes
  const stock = sizes?.length ? sizes.reduce((sum, s) => sum + s.stock, 0) : Number(body.stock ?? 0);
  if (!(price >= 0)) throw new HttpError(400, 'Price must be a positive number');
  if (!Number.isInteger(stock) || stock < 0) throw new HttpError(400, 'Stock must be a whole number ≥ 0');
  // Optional "was" price for sales. Empty = not on sale.
  const hasCompare = body.compare_at_price !== undefined && body.compare_at_price !== null && body.compare_at_price !== '';
  const compareAt = hasCompare ? Number(body.compare_at_price) : null;
  if (hasCompare && !(compareAt > price)) throw new HttpError(400, 'Old price must be higher than the price');
  return [
    body.name.trim(),
    slugify(body.slug || body.name),
    body.description || '',
    price,
    stock,
    body.image_url || null,
    body.category_id ? Number(body.category_id) : null,
    body.is_active ?? true,
    body.brand?.trim() || null,
    compareAt,
  ];
}

// POST /api/admin/products
router.post(
  '/products',
  asyncHandler(async (req, res) => {
    requireFields(req.body, ['name', 'price']);
    const sizes = parseSizes(req.body.sizes);
    const product = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO products (name, slug, description, price, stock, image_url, category_id, is_active,
                              brand, compare_at_price)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        productValues(req.body, sizes)
      );
      if (sizes?.length) await saveSizes(client, rows[0].id, sizes);
      return rows[0];
    });
    await logActivity(req, 'admin.product_created', { productId: product.id });
    res.status(201).json(product);
  })
);

// PUT /api/admin/products/:id
router.put(
  '/products/:id',
  asyncHandler(async (req, res) => {
    requireFields(req.body, ['name', 'price']);
    const id = Number(req.params.id);
    const sizes = parseSizes(req.body.sizes);
    const product = await withTransaction(async (client) => {
      // If sizes aren't sent, keep the existing ones and their total stock
      let existing = sizes;
      if (existing === undefined) {
        const { rows } = await client.query('SELECT size, stock FROM product_sizes WHERE product_id = $1', [id]);
        existing = rows;
      }
      const { rows } = await client.query(
        `UPDATE products SET name=$1, slug=$2, description=$3, price=$4, stock=$5, image_url=$6,
                category_id=$7, is_active=$8, brand=$9, compare_at_price=$10, updated_at=NOW()
         WHERE id=$11 RETURNING *`,
        [...productValues(req.body, existing), id]
      );
      if (!rows[0]) throw new HttpError(404, 'Product not found');
      if (sizes !== undefined) await saveSizes(client, id, sizes);
      return rows[0];
    });
    await logActivity(req, 'admin.product_updated', { productId: product.id });
    res.json(product);
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

// GET /api/admin/order-flows  -> the step order per payment method + every status (for filters)
router.get('/order-flows', (_req, res) => {
  const statuses = [...new Set([...Object.values(ORDER_FLOWS).flat(), 'cancelled'])];
  res.json({ flows: ORDER_FLOWS, statuses });
});

// GET /api/admin/orders?status=&payment=cash|card
router.get(
  '/orders',
  asyncHandler(async (req, res) => {
    const params = [];
    const where = [];
    if (req.query.status) {
      params.push(req.query.status);
      where.push(`o.status = $${params.length}`);
    }
    if (req.query.payment) {
      params.push(req.query.payment);
      where.push(`o.payment_method = $${params.length}`);
    }
    const { rows } = await query(
      `SELECT o.id, o.status, o.total, o.created_at, o.payment_method, o.payment_status, o.card_brand, o.card_last4,
              o.shipping_method, o.shipping_method_name, o.shipping_cost, u.name AS customer_name, u.email AS customer_email,
              (SELECT COALESCE(SUM(oi.quantity), 0)::int FROM order_items oi WHERE oi.order_id = o.id) AS item_count
       FROM orders o JOIN users u ON u.id = o.user_id
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY o.created_at DESC`,
      params
    );
    res.json(rows.map(withFlow));
  })
);

router.get(
  '/orders/:id',
  asyncHandler(async (req, res) => {
    res.json(await getOrderWithItems(Number(req.params.id), req.user));
  })
);

// DELETE /api/admin/orders/:id  -> removes the order and its items.
// Orders that were still open (not delivered, not cancelled) give their stock back first.
router.delete(
  '/orders/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const deleted = await withTransaction(async (client) => {
      const { rows } = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [id]);
      if (!rows[0]) throw new HttpError(404, 'Order not found');
      if (!['cancelled', 'delivered'].includes(rows[0].status)) {
        await releasePayment(rows[0]); // refund through Stripe if it was paid online
        await restock(client, id);
      }
      await client.query('DELETE FROM orders WHERE id = $1', [id]); // order_items are removed by ON DELETE CASCADE
      return rows[0];
    });
    await logActivity(req, 'admin.order_deleted', { orderId: id });
    orderChanged(deleted, 'order:deleted');
    res.status(204).end();
  })
);

// PATCH /api/admin/orders/:id/status  { status }
// Orders move forward through the flow of their payment method (see ORDER_FLOWS), or get cancelled.
router.patch(
  '/orders/:id/status',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const { status } = req.body;

    await withTransaction(async (client) => {
      const { rows } = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [id]);
      const order = rows[0];
      if (!order) throw new HttpError(404, 'Order not found');
      if (order.status === 'cancelled') throw new HttpError(400, 'Cancelled orders cannot be changed');
      if (status === 'cancelled') return cancelOrder(client, order); // restock + refund card payments

      // Card orders are marked paid by Stripe only - an admin can't skip the online payment
      if (order.payment_method === 'card' && order.payment_status !== 'paid') {
        throw new HttpError(400, 'This card order has not been paid online yet (waiting for Stripe)');
      }
      const flow = ORDER_FLOWS[order.payment_method];
      if (!flow.includes(status)) throw new HttpError(400, `Status must be one of: ${[...flow, 'cancelled'].join(', ')}`);
      if (flow.indexOf(status) <= flow.indexOf(order.status)) {
        throw new HttpError(400, `This order is already "${order.status}" — it can only move forward (${flow.join(' → ')})`);
      }
      // Cash orders count as paid once the courier has collected the money (paid or delivered)
      const markPaid = order.payment_method === 'cash' && ['paid', 'delivered'].includes(status);
      await client.query(
        `UPDATE orders SET status = $1, payment_status = CASE WHEN $2::boolean THEN 'paid' ELSE payment_status END WHERE id = $3`,
        [status, markPaid, id]
      );
    });

    await logActivity(req, 'admin.order_status', { orderId: id, status });
    const order = await getOrderWithItems(id, req.user);
    orderChanged(order);        // open pages update live
    notifyOrderStatus(order);   // "Your order is on its way" etc. for the customer
    res.json(order);
  })
);

export default router;
