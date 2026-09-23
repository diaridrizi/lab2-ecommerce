// Checkout and customer orders
import { Router } from 'express';
import { query, withTransaction } from '../config/postgres.js';
import { Cart } from '../models/Cart.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, HttpError, logActivity, requireFields } from '../utils/helpers.js';

const router = Router();
router.use(requireAuth);

// Loads an order with its items. Customers can only see their own orders.
export async function getOrderWithItems(orderId, user) {
  const { rows } = await query(
    `SELECT o.*, u.name AS customer_name, u.email AS customer_email
     FROM orders o JOIN users u ON u.id = o.user_id WHERE o.id = $1`,
    [orderId]
  );
  const order = rows[0];
  if (!order || (user.role !== 'admin' && order.user_id !== user.id)) {
    throw new HttpError(404, 'Order not found');
  }
  const items = await query(
    `SELECT oi.*, p.slug, p.image_url FROM order_items oi
     LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = $1 ORDER BY oi.id`,
    [orderId]
  );
  return { ...order, items: items.rows };
}

// POST /api/orders  -> checkout: turns the MongoDB cart into a PostgreSQL order
router.post(
  '/',
  asyncHandler(async (req, res) => {
    requireFields(req.body, ['shipping_name', 'shipping_address', 'shipping_city', 'shipping_phone']);
    const { shipping_name, shipping_address, shipping_city, shipping_phone } = req.body;

    const cart = await Cart.findOne({ userId: req.user.id }).lean();
    if (!cart || cart.items.length === 0) throw new HttpError(400, 'Your cart is empty');

    const orderId = await withTransaction(async (client) => {
      // Lock the product rows so two customers can't buy the last item at the same time
      const ids = cart.items.map((i) => i.productId);
      const { rows: products } = await client.query(
        'SELECT id, name, price, stock FROM products WHERE id = ANY($1) AND is_active FOR UPDATE',
        [ids]
      );
      const byId = new Map(products.map((p) => [p.id, p]));

      let total = 0;
      for (const item of cart.items) {
        const p = byId.get(item.productId);
        if (!p) throw new HttpError(400, 'A product in your cart is no longer available');
        if (item.quantity > p.stock) throw new HttpError(400, `Not enough stock for "${p.name}" (only ${p.stock} left)`);
        total += p.price * item.quantity;
      }

      const { rows } = await client.query(
        `INSERT INTO orders (user_id, total, shipping_name, shipping_address, shipping_city, shipping_phone)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [req.user.id, total.toFixed(2), shipping_name, shipping_address, shipping_city, shipping_phone]
      );
      const newOrderId = rows[0].id;

      for (const item of cart.items) {
        const p = byId.get(item.productId);
        await client.query(
          `INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity)
           VALUES ($1, $2, $3, $4, $5)`,
          [newOrderId, p.id, p.name, p.price, item.quantity]
        );
        await client.query('UPDATE products SET stock = stock - $1, updated_at = NOW() WHERE id = $2', [
          item.quantity,
          p.id,
        ]);
      }
      return newOrderId;
    });

    // Order is saved; now empty the cart and log the event in MongoDB
    await Cart.updateOne({ userId: req.user.id }, { $set: { items: [] } });
    await logActivity(req, 'order.created', { orderId });

    res.status(201).json(await getOrderWithItems(orderId, req.user));
  })
);

// GET /api/orders  -> my orders
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT o.id, o.status, o.total, o.created_at, COUNT(oi.id)::int AS item_count
       FROM orders o LEFT JOIN order_items oi ON oi.order_id = o.id
       WHERE o.user_id = $1 GROUP BY o.id ORDER BY o.created_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  })
);

// GET /api/orders/:id
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json(await getOrderWithItems(Number(req.params.id), req.user));
  })
);

// POST /api/orders/:id/cancel  -> customer cancels a pending order (stock is returned)
router.post(
  '/:id/cancel',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    await withTransaction(async (client) => {
      const { rows } = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [id]);
      const order = rows[0];
      if (!order || order.user_id !== req.user.id) throw new HttpError(404, 'Order not found');
      if (order.status !== 'pending') throw new HttpError(400, 'Only pending orders can be cancelled');
      await restock(client, id);
      await client.query("UPDATE orders SET status = 'cancelled' WHERE id = $1", [id]);
    });
    await logActivity(req, 'order.cancelled', { orderId: id });
    res.json(await getOrderWithItems(id, req.user));
  })
);

// Puts the items of an order back into stock
export async function restock(client, orderId) {
  await client.query(
    `UPDATE products p SET stock = p.stock + oi.quantity, updated_at = NOW()
     FROM order_items oi WHERE oi.order_id = $1 AND oi.product_id = p.id`,
    [orderId]
  );
}

export default router;
