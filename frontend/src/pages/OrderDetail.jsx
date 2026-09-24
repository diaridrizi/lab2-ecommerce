import { useEffect, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { api, formatDate, money } from '../api.js';
import StatusBadge from '../components/StatusBadge.jsx';
import { PaymentMethod, PaymentStatus } from '../components/PaymentInfo.jsx';
import { LockIcon } from '../components/Icons.jsx';
import { useRealtime } from '../context/NotificationContext.jsx';

// Only the display text; the step order comes from the backend (order.steps), per payment method
const STEP_LABELS = { pending: 'Order placed', paid: 'Paid', shipped: 'Shipped', delivered: 'Delivered' };

export default function OrderDetail() {
  const { id } = useParams();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  // Set when Stripe sends the customer back here: 'paid' or 'cancelled'
  const [paymentResult, setPaymentResult] = useState(searchParams.get('payment') === 'cancelled' ? 'cancelled' : null);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    if (sessionId) {
      // Back from Stripe: ask the server to check the payment with Stripe
      api.post('/payments/confirm', { session_id: sessionId })
        .then((o) => {
          setOrder(o);
          setPaymentResult(o.payment_status === 'paid' ? 'paid' : 'cancelled');
        })
        .catch((e) => setError(e.message))
        .finally(() => setSearchParams({}, { replace: true })); // clean the URL so a reload doesn't confirm again
    } else {
      api.get(`/orders/${id}`).then(setOrder).catch((e) => setError(e.message));
      if (searchParams.get('payment')) setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Live: the admin shipped the order, Stripe confirmed the payment, ... -> reload without refreshing the page
  useRealtime('order:updated', (o) => {
    if (o.id === Number(id)) api.get(`/orders/${id}`).then(setOrder).catch(() => {});
  });
  useRealtime('order:deleted', (o) => {
    if (o.id === Number(id)) setError('This order was deleted by the shop.');
  });

  // New Stripe payment page for an unpaid card order
  const payNow = async () => {
    setPaying(true);
    try {
      const { checkout_url } = await api.post(`/orders/${id}/pay`);
      window.location.assign(checkout_url);
    } catch (e) {
      setError(e.message);
      setPaying(false);
    }
  };

  const cancel = async () => {
    const refund = order.payment_status === 'paid' ? ' Your card payment will be refunded.' : '';
    if (!window.confirm(`Cancel this order?${refund}`)) return;
    try {
      setOrder(await api.post(`/orders/${id}/cancel`));
    } catch (e) {
      setError(e.message);
    }
  };

  if (error) return <p className="alert alert-error">{error}</p>;
  if (!order) return <p className="muted">Loading…</p>;

  const subtotal = order.items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const stepIndex = order.steps.indexOf(order.status);
  const canCancel = order.can_cancel;
  const awaitingPayment = order.payment_method === 'card' && order.payment_status === 'unpaid' && order.status === 'pending';

  return (
    <>
      <Link to="/orders" className="back">← All orders</Link>
      {(location.state?.justPlaced || paymentResult === 'paid') && (
        <div className="order-success">
          <span className="order-success-check">✓</span>
          <div>
            <strong>Thank you! Your order has been placed.</strong>
            <p>
              {order.payment_method === 'card'
                ? `Your ${order.card_brand || 'card'}${order.card_last4 ? ` ending in ${order.card_last4}` : ''} was charged ${money(order.total)}.`
                : `Please have ${money(order.total)} ready in cash when your order arrives.`}
            </p>
          </div>
        </div>
      )}
      {awaitingPayment && (
        <div className="alert alert-warning payment-pending">
          <div>
            <strong>{paymentResult === 'cancelled' ? 'The payment was not completed.' : 'This order is waiting for payment.'}</strong>
            <p>Your items are reserved. Pay by card to confirm the order, or cancel it.</p>
          </div>
          <button className="btn btn-primary" onClick={payNow} disabled={paying}>
            {paying ? 'Opening…' : <><LockIcon width={16} height={16} /> Pay {money(order.total)}</>}
          </button>
        </div>
      )}
      <div className="page-head">
        <h1>Order #{order.id}</h1>
        <StatusBadge status={order.status} />
      </div>
      <p className="muted">Placed {formatDate(order.created_at)}</p>

      {order.status === 'cancelled' ? (
        <p className="alert alert-error">This order was cancelled{order.payment_status === 'refunded' ? ' and the card payment was refunded' : ''}.</p>
      ) : (
        <ol className="order-steps">
          {order.steps.map((s, i) => (
            <li key={s} className={i <= stepIndex ? 'done' : ''} style={{ '--i': i }}>
              <span className="order-step-dot">{i <= stepIndex ? '✓' : i + 1}</span>
              {s === 'paid' && order.payment_method === 'cash' ? 'Paid (cash)' : STEP_LABELS[s] || s}
            </li>
          ))}
        </ol>
      )}

      <div className="cart-layout">
        <div>
          {order.items.map((i) => (
            <div key={i.id} className="cart-row">
              {i.image_url && <img src={i.image_url} alt="" />}
              <div className="grow">
                {i.brand && <span className="product-brand">{i.brand}</span>}
                {i.slug ? <Link to={`/products/${i.slug}`} className="cart-name">{i.product_name}</Link> : <span className="cart-name">{i.product_name}</span>}
                <div className="muted small">
                  {money(i.unit_price)} × {i.quantity}{i.size && <> · Size <strong className="text">{i.size}</strong></>}
                </div>
              </div>
              <strong className="line-total">{money(i.unit_price * i.quantity)}</strong>
            </div>
          ))}
          <div className="order-totals">
            <div className="summary-row"><span>Subtotal</span><span>{money(subtotal)}</span></div>
            <div className="summary-row">
              <span>{order.shipping_method_name || order.shipping_method}</span>
              <span>{Number(order.shipping_cost) ? money(order.shipping_cost) : 'Free'}</span>
            </div>
            <div className="summary-row total"><span>Total</span><span>{money(order.total)}</span></div>
          </div>
        </div>

        <aside className="card summary">
          <h3>Payment</h3>
          <p className="info-line"><PaymentMethod order={order} /> <PaymentStatus status={order.payment_status} /></p>

          <h3>Shipping to</h3>
          <p>
            {order.shipping_name}<br />
            {order.shipping_address}<br />
            {[order.shipping_postal_code, order.shipping_city].filter(Boolean).join(' ')}<br />
            {order.shipping_country}
          </p>
          <h3>Contact</h3>
          <p>
            {order.shipping_email && <>{order.shipping_email}<br /></>}
            {order.shipping_phone}
          </p>
          {order.notes && (
            <>
              <h3>Notes</h3>
              <p className="order-notes">{order.notes}</p>
            </>
          )}
          {canCancel && <button className="btn btn-danger btn-block" onClick={cancel}>Cancel order</button>}
        </aside>
      </div>
    </>
  );
}
