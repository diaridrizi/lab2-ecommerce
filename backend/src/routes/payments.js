// Stripe payment results.
// Two ways an order learns it was paid (both are safe to run more than once):
//   1. POST /api/payments/confirm  - the browser comes back from Stripe with ?session_id=...
//   2. POST /api/payments/webhook  - Stripe calls us directly (also works if the customer closes the tab)
// In both cases we ask Stripe itself for the session, so a customer can't fake a payment.
import express, { Router } from 'express';
import { env } from '../config/env.js';
import { query, withTransaction } from '../config/postgres.js';
import { notifyAdmins, notifyOrderStatus, notifyUser, orderChanged } from '../utils/notify.js';
import { money } from '../utils/format.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, HttpError, logActivity } from '../utils/helpers.js';
import { paymentDetails, requireStripe, stripeEnabled } from '../utils/payment.js';
import { cancelOrder, getOrderWithItems } from './orders.js';

const router = Router();

// Applies a Stripe Checkout Session to its order: paid -> mark the order paid, expired -> cancel it.
async function applySession(req, session) {
  const orderId = Number(session.metadata?.order_id);
  if (!orderId) return null;

  if (session.payment_status === 'paid') {
    const card = await paymentDetails(session);
    const result = await withTransaction(async (client) => {
      const { rows } = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [orderId]);
      const order = rows[0];
      if (!order || order.payment_status !== 'unpaid') return null; // already handled
      if (order.status === 'cancelled') {
        // The customer cancelled while the payment was still going through: give the money back
        await requireStripe().refunds.create({ payment_intent: card.intentId });
        await client.query(
          `UPDATE orders SET payment_status = 'refunded', stripe_payment_intent = $1, card_brand = $2, card_last4 = $3 WHERE id = $4`,
          [card.intentId, card.brand, card.last4, orderId]
        );
        return 'payment.refunded_late';
      }
      await client.query(
        `UPDATE orders SET status = 'paid', payment_status = 'paid', paid_at = NOW(),
                stripe_session_id = $1, stripe_payment_intent = $2, card_brand = $3, card_last4 = $4
         WHERE id = $5`,
        [session.id, card.intentId, card.brand, card.last4, orderId]
      );
      return 'payment.succeeded';
    });
    if (result) {
      await logActivity(req, result, { orderId, sessionId: session.id });
      await announcePayment(orderId, result);
    }
    return orderId;
  }

  if (session.status === 'expired') {
    // Payment page timed out: cancel the order and put the items back in stock
    const cancelled = await withTransaction(async (client) => {
      const { rows } = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [orderId]);
      const order = rows[0];
      // Only if this is still the current payment page (the customer may have opened a newer one)
      if (!order || order.status !== 'pending' || order.payment_status !== 'unpaid' || order.stripe_session_id !== session.id) return false;
      await cancelOrder(client, order);
      return true;
    });
    if (cancelled) {
      await logActivity(req, 'payment.expired', { orderId, sessionId: session.id });
      await announcePayment(orderId, 'payment.expired');
    }
  }
  return orderId;
}

// Live update + notifications after Stripe told us what happened
async function announcePayment(orderId, result) {
  const { rows } = await query(
    'SELECT o.*, u.name AS customer_name FROM orders o JOIN users u ON u.id = o.user_id WHERE o.id = $1', [orderId]
  );
  const order = rows[0];
  if (!order) return;
  orderChanged(order);
  const link = `/orders/${order.id}`;
  if (result === 'payment.succeeded') {
    notifyOrderStatus(order); // "Payment confirmed"
    notifyAdmins({
      type: 'payment.received', title: `Payment received for order #${order.id}`,
      message: `${order.customer_name} paid ${money(order.total)} by ${order.card_brand || 'card'}${order.card_last4 ? ` •••• ${order.card_last4}` : ''}`,
      link: '/admin/orders',
    });
  } else if (result === 'payment.refunded_late') {
    notifyUser(order.user_id, {
      type: 'payment.refunded', title: 'Payment refunded',
      message: `Order #${order.id} had already been cancelled, so your payment of ${money(order.total)} was refunded.`, link,
    });
  } else if (result === 'payment.expired') {
    notifyUser(order.user_id, {
      type: 'order.cancelled', title: 'Order cancelled',
      message: `Order #${order.id} was cancelled because it was not paid within 30 minutes.`, link,
    });
  }
}

// GET /api/payments/config  -> is online card payment available? (the checkout page asks this)
router.get('/config', (_req, res) => {
  res.json({ card: stripeEnabled, provider: 'stripe', currency: env.currency, testMode: env.stripeSecretKey.startsWith('sk_test_') });
});

// POST /api/payments/confirm  { session_id }  -> called by the order page after Stripe redirects back
router.post(
  '/confirm',
  requireAuth,
  asyncHandler(async (req, res) => {
    const sessionId = String(req.body.session_id || '');
    if (!sessionId.startsWith('cs_')) throw new HttpError(400, 'Invalid payment session');
    let session;
    try {
      session = await requireStripe().checkout.sessions.retrieve(sessionId);
    } catch {
      throw new HttpError(404, 'Payment session not found');
    }
    const orderId = Number(session.metadata?.order_id);
    const order = await getOrderWithItems(orderId, req.user); // 404 if it's not this customer's order
    if (order.stripe_session_id !== session.id && order.payment_status === 'unpaid') {
      throw new HttpError(400, 'This payment page is no longer valid');
    }
    await applySession(req, session);
    res.json(await getOrderWithItems(orderId, req.user));
  })
);

// POST /api/payments/webhook  -> events sent by Stripe. Needs the raw body to check Stripe's signature,
// so it is mounted in app.js before express.json().
export const stripeWebhook = [
  express.raw({ type: 'application/json' }),
  asyncHandler(async (req, res) => {
    if (!env.stripeWebhookSecret) throw new HttpError(400, 'STRIPE_WEBHOOK_SECRET is not set');
    let event;
    try {
      event = requireStripe().webhooks.constructEvent(req.body, req.get('stripe-signature'), env.stripeWebhookSecret);
    } catch (err) {
      throw new HttpError(400, `Webhook signature check failed: ${err.message}`);
    }
    if (['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'checkout.session.expired'].includes(event.type)) {
      await applySession(req, event.data.object);
    }
    res.json({ received: true });
  }),
];

export default router;
