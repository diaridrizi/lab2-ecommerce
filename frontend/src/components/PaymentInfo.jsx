import { CardIcon, CashIcon } from './Icons.jsx';

// "Visa •••• 4242" or "Cash on delivery", with an icon. Card details are filled in once Stripe confirms the payment.
export function PaymentMethod({ order }) {
  if (order.payment_method === 'card') {
    return (
      <span className="pay-method">
        <CardIcon width={18} height={18} /> {order.card_brand || 'Card (Stripe)'}{order.card_last4 && ` •••• ${order.card_last4}`}
      </span>
    );
  }
  return <span className="pay-method"><CashIcon width={18} height={18} /> Cash on delivery</span>;
}

// unpaid / paid / refunded
export function PaymentStatus({ status }) {
  return <span className={`status pay-${status}`}>{status}</span>;
}
