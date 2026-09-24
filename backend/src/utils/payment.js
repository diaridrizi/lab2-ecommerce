// Online card payments through Stripe Checkout.
// The customer types their card on Stripe's own page (PCI compliant), so card numbers never reach our server.
// We only keep the Stripe ids, the card brand and the last 4 digits that Stripe sends back.
import Stripe from 'stripe';
import { env } from '../config/env.js';
import { HttpError } from './helpers.js';

export const stripe = env.stripeSecretKey ? new Stripe(env.stripeSecretKey) : null;
export const stripeEnabled = Boolean(stripe);

export function requireStripe() {
  if (!stripe) throw new HttpError(503, 'Card payments are not set up yet (STRIPE_SECRET_KEY is missing in backend/.env)');
  return stripe;
}

// Stripe works in the smallest currency unit: €12.50 -> 1250
const cents = (amount) => Math.round(Number(amount) * 100);

// "visa" -> "Visa", "amex" -> "Amex"
const BRANDS = { visa: 'Visa', mastercard: 'Mastercard', amex: 'Amex', discover: 'Discover', unionpay: 'UnionPay', jcb: 'JCB' };
const brandName = (brand) => BRANDS[brand] || (brand ? brand[0].toUpperCase() + brand.slice(1) : 'Card');

// Creates the Stripe payment page for an order.
// order: a row from `orders`; items: [{ product_name, unit_price, quantity, size, image_url }]
export async function createCheckoutSession(order, items) {
  const line_items = items.map((i) => ({
    quantity: i.quantity,
    price_data: {
      currency: env.currency,
      unit_amount: cents(i.unit_price),
      product_data: {
        name: i.size ? `${i.product_name} (size ${i.size})` : i.product_name,
        ...(i.image_url?.startsWith('https://') ? { images: [i.image_url] } : {}),
      },
    },
  }));
  if (Number(order.shipping_cost) > 0) {
    line_items.push({
      quantity: 1,
      price_data: { currency: env.currency, unit_amount: cents(order.shipping_cost), product_data: { name: order.shipping_method_name || 'Delivery' } },
    });
  }

  return requireStripe().checkout.sessions.create({
    mode: 'payment',
    line_items,
    customer_email: order.shipping_email || undefined,
    client_reference_id: String(order.id),
    metadata: { order_id: String(order.id) },
    payment_intent_data: { metadata: { order_id: String(order.id) } },
    // The page stays open for 30 minutes (Stripe's minimum); after that the order is cancelled (see the webhook)
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    success_url: `${env.clientUrl}/orders/${order.id}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.clientUrl}/orders/${order.id}?payment=cancelled`,
  });
}

// Reads the card brand + last 4 digits from a paid session
export async function paymentDetails(session) {
  const intentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
  if (!intentId) return { intentId: null, brand: 'Card', last4: null };
  const intent = await requireStripe().paymentIntents.retrieve(intentId, { expand: ['latest_charge'] });
  const card = intent.latest_charge?.payment_method_details?.card;
  return { intentId, brand: brandName(card?.brand), last4: card?.last4 ?? null };
}

// When an order is cancelled or deleted: refund a Stripe payment, or close a payment page that wasn't paid yet.
// Returns true if money was refunded.
export async function releasePayment(order) {
  if (order.payment_method !== 'card') return false;
  if (order.payment_status === 'paid' && order.stripe_payment_intent) {
    await requireStripe().refunds.create({ payment_intent: order.stripe_payment_intent });
    return true;
  }
  if (order.payment_status === 'unpaid' && order.stripe_session_id && stripe) {
    // Fails if the page already expired - that's fine, it can't be paid either way
    await stripe.checkout.sessions.expire(order.stripe_session_id).catch(() => {});
  }
  return false;
}
