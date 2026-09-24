// Sends notifications: saved in MongoDB + pushed live over WebSockets.
// Never throws - a failed notification must not break an order or payment.
import { query } from '../config/postgres.js';
import { Notification } from '../models/Notification.js';
import { emitToAdmins, emitToUser } from '../realtime/socket.js';
import { money } from './format.js';

async function safe(fn) {
  try {
    await fn();
  } catch (err) {
    console.error('Notification failed:', err.message);
  }
}

// { type, title, message, link } for one user
export const notifyUser = (userId, payload) =>
  safe(async () => {
    if (!userId) return;
    const n = await Notification.create({ userId, ...payload });
    emitToUser(userId, 'notification', n.toJSON());
  });

// The same notification for every admin
export const notifyAdmins = (payload) =>
  safe(async () => {
    const { rows } = await query("SELECT id FROM users WHERE role = 'admin'");
    const docs = await Notification.insertMany(rows.map((r) => ({ userId: r.id, ...payload })));
    for (const n of docs) emitToUser(n.userId, 'notification', n.toJSON());
  });

// Live data update (not a notification): open order pages and the admin order list refresh themselves
export function orderChanged(order, event = 'order:updated') {
  const data = { id: order.id, status: order.status, payment_status: order.payment_status, user_id: order.user_id };
  emitToUser(order.user_id, event, data);
  emitToAdmins(event, data);
}

// Texts for the customer when an order moves to a new step
const CUSTOMER_MESSAGES = {
  paid: (o) => o.payment_method === 'cash'
    ? ['Payment received', `We received your cash payment of ${money(o.total)} for order #${o.id}.`]
    : ['Payment confirmed', `Your card payment of ${money(o.total)} for order #${o.id} was successful.`],
  shipped: (o) => ['Your order is on its way', `Order #${o.id} has been shipped${o.shipping_method_name ? ` (${o.shipping_method_name})` : ''}.`],
  delivered: (o) => ['Order delivered', `Order #${o.id} has been delivered. Enjoy your new gear!`],
  cancelled: (o) => ['Order cancelled', `Order #${o.id} was cancelled${o.payment_status === 'refunded' ? ' and your payment was refunded' : ''}.`],
};

export function notifyOrderStatus(order) {
  const text = CUSTOMER_MESSAGES[order.status]?.(order);
  if (!text) return Promise.resolve();
  return notifyUser(order.user_id, { type: `order.${order.status}`, title: text[0], message: text[1], link: `/orders/${order.id}` });
}
