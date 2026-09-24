// Checkout and customer orders
import { Router } from 'express';
import { query, withTransaction } from '../config/postgres.js';
import { Cart } from '../models/Cart.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, HttpError, logActivity, requireFields } from '../utils/helpers.js';
import { createCheckoutSession, releasePayment, requireStripe } from '../utils/payment.js';
import { notifyAdmins, notifyUser, orderChanged } from '../utils/notify.js';
import { money } from '../utils/format.js';

const router = Router();
router.use(requireAuth);

// The steps an order goes through, per payment method.
// Card: paid online (Stripe) right after checkout. Cash: the courier collects the money, so "paid" comes after "shipped".
export const ORDER_FLOWS = {
  card: ['pending', 'paid', 'shipped', 'delivered'],
  cash: ['pending', 'shipped', 'paid', 'delivered'],
};

// Customers can cancel until the order has been shipped
export function canCustomerCancel(order) {
  const flow = ORDER_FLOWS[order.payment_method];
  return order.status !== 'cancelled' && flow.indexOf(order.status) < flow.indexOf('shipped');
}

// Adds `steps` (the flow for this order) and `can_cancel` so the frontend doesn't hardcode them
export const withFlow = (order) => ({ ...order, steps: ORDER_FLOWS[order.payment_method], can_cancel: canCustomerCancel(order) });

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
    `SELECT oi.*, p.slug, p.image_url, p.brand FROM order_items oi
     LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = $1 ORDER BY oi.id`,
    [orderId]
  );
  return { ...withFlow(order), items: items.rows };
}

const SHIPPING_FIELDS = [
  'shipping_name', 'shipping_email', 'shipping_phone', 'shipping_address',
  'shipping_city', 'shipping_postal_code', 'shipping_country',
];

// POST /api/orders  -> checkout: turns the MongoDB cart into a PostgreSQL order
// body: { shipping_*, notes, shipping_method: 'standard'|'express', payment_method: 'cash'|'card' }
router.post(
  '/',
  asyncHandler(async (req, res) => {
    requireFields(req.body, SHIPPING_FIELDS);
    if (!/^\S+@\S+\.\S+$/.test(req.body.shipping_email)) throw new HttpError(400, 'Email address is not valid');

    // Delivery methods live in the shipping_methods table (managed in Admin → Delivery)
    const { rows: methods } = await query('SELECT code, name, price FROM shipping_methods WHERE code = $1 AND is_active', [
      req.body.shipping_method,
    ]);
    const shipping = methods[0];
    if (!shipping) throw new HttpError(400, 'Please choose a delivery method');
    const shippingMethod = shipping.code;

    const paymentMethod = req.body.payment_method || 'cash';
    if (!['cash', 'card'].includes(paymentMethod)) throw new HttpError(400, 'Unknown payment method');
    if (paymentMethod === 'card') requireStripe();

    const cart = await Cart.findOne({ userId: req.user.id }).lean();
    if (!cart || cart.items.length === 0) throw new HttpError(400, 'Your cart is empty');

    const { orderId, checkoutUrl } = await withTransaction(async (client) => {
      // Lock the product and size rows so two customers can't buy the last item at the same time
      const ids = [...new Set(cart.items.map((i) => i.productId))];
      const { rows: products } = await client.query(
        'SELECT id, name, price, stock, image_url FROM products WHERE id = ANY($1) AND is_active FOR UPDATE',
        [ids]
      );
      const { rows: sizes } = await client.query(
        'SELECT product_id, size, stock FROM product_sizes WHERE product_id = ANY($1) FOR UPDATE',
        [ids]
      );
      const byId = new Map(products.map((p) => [p.id, p]));
      const sizeStock = new Map(sizes.map((s) => [`${s.product_id}:${s.size}`, s.stock]));
      const hasSizes = new Set(sizes.map((s) => s.product_id));

      let subtotal = 0;
      for (const item of cart.items) {
        const p = byId.get(item.productId);
        if (!p) throw new HttpError(400, 'A product in your cart is no longer available');
        if (hasSizes.has(p.id) && !item.size) throw new HttpError(400, `Please choose a size for "${p.name}"`);
        const stock = item.size ? sizeStock.get(`${p.id}:${item.size}`) ?? 0 : p.stock;
        if (item.quantity > stock) {
          const label = item.size ? `"${p.name}" in size ${item.size}` : `"${p.name}"`;
          throw new HttpError(400, `Not enough stock for ${label} (only ${stock} left)`);
        }
        subtotal += p.price * item.quantity;
      }
      const total = subtotal + shipping.price;

      // Every order starts as pending + unpaid. Card orders become "paid" when Stripe confirms the payment;
      // cash orders when the courier has collected the money.
      const b = req.body;
      const { rows } = await client.query(
        `INSERT INTO orders (user_id, status, total, shipping_name, shipping_email, shipping_phone, shipping_address,
                             shipping_city, shipping_postal_code, shipping_country, notes, shipping_method, shipping_cost,
                             payment_method, payment_status, shipping_method_name)
         VALUES ($1, 'pending', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'unpaid', $14) RETURNING *`,
        [req.user.id, total.toFixed(2), b.shipping_name.trim(), b.shipping_email.trim(),
          b.shipping_phone.trim(), b.shipping_address.trim(), b.shipping_city.trim(), b.shipping_postal_code.trim(),
          b.shipping_country.trim(), b.notes?.trim() || null, shippingMethod, shipping.price,
          paymentMethod, shipping.name]
      );
      const order = rows[0];
      const newOrderId = order.id;

      for (const item of cart.items) {
        const p = byId.get(item.productId);
        await client.query(
          `INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, size)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [newOrderId, p.id, p.name, p.price, item.quantity, item.size ?? null]
        );
        // products.stock is the total; sized products also lose stock in their size row
        await client.query('UPDATE products SET stock = stock - $1, updated_at = NOW() WHERE id = $2', [item.quantity, p.id]);
        if (item.size) {
          await client.query('UPDATE product_sizes SET stock = stock - $1 WHERE product_id = $2 AND size = $3', [
            item.quantity, p.id, item.size,
          ]);
        }
      }

      // Card: open a Stripe payment page. Done inside the transaction, so if Stripe fails nothing is saved.
      if (paymentMethod !== 'card') return { orderId: newOrderId };
      const session = await createCheckoutSession(order, cart.items.map((item) => {
        const p = byId.get(item.productId);
        return { product_name: p.name, unit_price: p.price, quantity: item.quantity, size: item.size, image_url: p.image_url };
      }));
      await client.query('UPDATE orders SET stripe_session_id = $1 WHERE id = $2', [session.id, newOrderId]);
      return { orderId: newOrderId, checkoutUrl: session.url };
    });

    // Order is saved; now empty the cart and log the event in MongoDB
    await Cart.updateOne({ userId: req.user.id }, { $set: { items: [] } });
    await logActivity(req, 'order.created', { orderId, paymentMethod, shippingMethod });

    const placed = await getOrderWithItems(orderId, req.user);
    notifyOrderPlaced(placed);

    // checkout_url: the frontend sends the customer there to pay by card
    res.status(201).json({ ...placed, checkout_url: checkoutUrl ?? null });
  })
);

// POST /api/orders/:id/pay  -> a new Stripe payment page for a card order that wasn't paid yet
// (e.g. the customer pressed "back" on Stripe or the page expired)
router.post(
  '/:id/pay',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    requireStripe();
    const url = await withTransaction(async (client) => {
      const { rows } = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [id]);
      const order = rows[0];
      if (!order || order.user_id !== req.user.id) throw new HttpError(404, 'Order not found');
      if (order.payment_method !== 'card' || order.payment_status !== 'unpaid' || order.status !== 'pending') {
        throw new HttpError(400, 'This order does not need to be paid online');
      }
      // Close the old page first so the order can't be paid twice
      await releasePayment(order);
      const { rows: items } = await client.query(
        `SELECT oi.product_name, oi.unit_price, oi.quantity, oi.size, p.image_url
         FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = $1 ORDER BY oi.id`,
        [id]
      );
      const session = await createCheckoutSession(order, items);
      await client.query('UPDATE orders SET stripe_session_id = $1 WHERE id = $2', [session.id, id]);
      return session.url;
    });
    await logActivity(req, 'payment.retry', { orderId: id });
    res.json({ checkout_url: url });
  })
);

// GET /api/orders  -> my orders
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT o.id, o.status, o.total, o.created_at, o.payment_method, o.payment_status, o.card_brand, o.card_last4,
              COALESCE(SUM(oi.quantity), 0)::int AS item_count
       FROM orders o LEFT JOIN order_items oi ON oi.order_id = o.id
       WHERE o.user_id = $1 GROUP BY o.id ORDER BY o.created_at DESC`,
      [req.user.id]
    );
    res.json(rows.map(withFlow));
  })
);

// GET /api/orders/:id
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json(await getOrderWithItems(Number(req.params.id), req.user));
  })
);

// POST /api/orders/:id/cancel  -> customer cancels an order that hasn't shipped yet (stock is returned)
router.post(
  '/:id/cancel',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    await withTransaction(async (client) => {
      const { rows } = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [id]);
      const order = rows[0];
      if (!order || order.user_id !== req.user.id) throw new HttpError(404, 'Order not found');
      if (!canCustomerCancel(order)) throw new HttpError(400, 'Orders that have shipped cannot be cancelled');
      await cancelOrder(client, order);
    });
    await logActivity(req, 'order.cancelled', { orderId: id });
    const order = await getOrderWithItems(id, req.user);
    orderChanged(order);
    notifyAdmins({
      type: 'order.cancelled', title: `Order #${id} cancelled by the customer`,
      message: `${order.customer_name} · ${money(order.total)}${order.payment_status === 'refunded' ? ' · refunded' : ''}`, link: '/admin/orders',
    });
    res.json(order);
  })
);

// Live updates + notifications after checkout
async function notifyOrderPlaced(order) {
  orderChanged(order, 'order:created');
  const card = order.payment_method === 'card';
  notifyAdmins({
    type: 'order.new', title: `New order #${order.id}`,
    message: `${order.customer_name} · ${money(order.total)} · ${card ? 'card (waiting for payment)' : 'cash on delivery'}`,
    link: '/admin/orders',
  });
  // Card orders get their confirmation when Stripe confirms the payment
  if (!card) {
    notifyUser(order.user_id, {
      type: 'order.placed', title: 'Order placed',
      message: `Thank you! Order #${order.id} is confirmed. Please have ${money(order.total)} ready in cash on delivery.`,
      link: `/orders/${order.id}`,
    });
  }
  // Warn admins when this order brought a product (or one of its sizes) down to 5 or less
  try {
    const { rows } = await query(
      `SELECT DISTINCT p.name, oi.size, COALESCE(ps.stock, p.stock) AS stock
       FROM order_items oi JOIN products p ON p.id = oi.product_id
       LEFT JOIN product_sizes ps ON ps.product_id = p.id AND ps.size = oi.size
       WHERE oi.order_id = $1 AND COALESCE(ps.stock, p.stock) <= 5`,
      [order.id]
    );
    if (rows.length) {
      notifyAdmins({
        type: 'stock.low', title: rows.length === 1 ? 'Low stock' : `Low stock on ${rows.length} items`,
        message: rows.map((r) => `${r.name}${r.size ? ` (${r.size})` : ''}: ${r.stock} left`).join(', '),
        link: '/admin/products',
      });
    }
  } catch (err) {
    console.error('Low stock check failed:', err.message);
  }
}

// Puts the items of an order back into stock (total and per size)
export async function restock(client, orderId) {
  await client.query(
    `UPDATE products p SET stock = p.stock + oi.quantity, updated_at = NOW()
     FROM order_items oi WHERE oi.order_id = $1 AND oi.product_id = p.id`,
    [orderId]
  );
  await client.query(
    `UPDATE product_sizes ps SET stock = ps.stock + oi.quantity
     FROM order_items oi WHERE oi.order_id = $1 AND oi.product_id = ps.product_id AND oi.size = ps.size`,
    [orderId]
  );
}

// Cancels an order: returns stock and refunds card payments through Stripe.
// The refund happens inside the transaction: if Stripe refuses it, the order is not cancelled.
export async function cancelOrder(client, order) {
  await releasePayment(order);
  await restock(client, order.id);
  await client.query(
    `UPDATE orders SET status = 'cancelled',
            payment_status = CASE WHEN payment_status = 'paid' THEN 'refunded' ELSE payment_status END
     WHERE id = $1`,
    [order.id]
  );
}

export default router;
