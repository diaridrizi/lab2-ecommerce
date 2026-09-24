import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api, money } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { CardIcon, CashIcon, LockIcon } from '../components/Icons.jsx';

const COUNTRIES = [
  'Kosovo', 'Albania', 'North Macedonia', 'Montenegro', 'Serbia', 'Switzerland', 'Germany',
  'Austria', 'Italy', 'France', 'Netherlands', 'United Kingdom', 'United States',
];

export default function Checkout() {
  const { user } = useAuth();
  const { cart, loaded, clear } = useCart();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    first_name: user?.name?.split(' ')[0] || '',
    last_name: user?.name?.split(' ').slice(1).join(' ') || '',
    shipping_email: user?.email || '',
    shipping_phone: '',
    shipping_address: '',
    shipping_city: '',
    shipping_postal_code: '',
    shipping_country: '',
    notes: '',
    shipping_method: '',
    payment_method: 'card',
  });
  // Delivery options come from PostgreSQL (Admin → Delivery); the first one is pre-selected
  const [methods, setMethods] = useState(null);
  useEffect(() => {
    api.get('/shipping-methods').then((list) => {
      setMethods(list);
      setForm((f) => ({ ...f, shipping_method: f.shipping_method || list[0]?.code || '' }));
    }).catch(() => setMethods([]));
  }, []);
  // Is online card payment (Stripe) set up on the server? If not, only cash on delivery is offered.
  const [payments, setPayments] = useState(null);
  useEffect(() => {
    api.get('/payments/config').then((config) => {
      setPayments(config);
      if (!config.card) setForm((f) => ({ ...f, payment_method: 'cash' }));
    }).catch(() => {
      setPayments({ card: false });
      setForm((f) => ({ ...f, payment_method: 'cash' }));
    });
  }, []);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!loaded) return <p className="muted">Loading…</p>;
  if (cart.items.length === 0 && !submitting) return <Navigate to="/cart" replace />;

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const delivery = methods?.find((d) => d.code === form.shipping_method);
  const deliveryCost = delivery ? Number(delivery.price) : 0;
  const total = cart.subtotal + deliveryCost;
  const cardEnabled = Boolean(payments?.card);
  const payByCard = form.payment_method === 'card';

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    const { first_name, last_name, ...rest } = form;
    try {
      const order = await api.post('/orders', {
        ...rest,
        shipping_name: `${first_name} ${last_name}`.trim(),
      });
      clear();
      // Card: go to Stripe's secure payment page. Stripe sends the customer back to the order page afterwards.
      if (order.checkout_url) {
        window.location.assign(order.checkout_url);
        return;
      }
      navigate(`/orders/${order.id}`, { state: { justPlaced: true } });
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <>
      <nav className="breadcrumbs">
        <Link to="/cart">Cart</Link> <span>/</span> <span>Checkout</span>
      </nav>
      <h1>Checkout</h1>
      {error && <p className="alert alert-error">{error}</p>}

      <form className="checkout-layout" onSubmit={onSubmit}>
        <div className="checkout-main">
          <section className="checkout-step">
            <h3><span className="step-num">1</span> Contact</h3>
            <div className="form form-grid">
              <label>Email<input type="email" name="shipping_email" value={form.shipping_email} onChange={onChange} autoComplete="email" required /></label>
              <label>Phone<input type="tel" name="shipping_phone" value={form.shipping_phone} onChange={onChange} autoComplete="tel" placeholder="+383 44 123 456" required /></label>
            </div>
          </section>

          <section className="checkout-step">
            <h3><span className="step-num">2</span> Shipping address</h3>
            <div className="form form-grid">
              <label>First name<input name="first_name" value={form.first_name} onChange={onChange} autoComplete="given-name" required /></label>
              <label>Last name<input name="last_name" value={form.last_name} onChange={onChange} autoComplete="family-name" required /></label>
              <label className="span-2">Street and house number<input name="shipping_address" value={form.shipping_address} onChange={onChange} autoComplete="street-address" required /></label>
              <label>Postal code<input name="shipping_postal_code" value={form.shipping_postal_code} onChange={onChange} autoComplete="postal-code" required /></label>
              <label>City<input name="shipping_city" value={form.shipping_city} onChange={onChange} autoComplete="address-level2" required /></label>
              <label className="span-2">
                Country
                <select name="shipping_country" value={form.shipping_country} onChange={onChange} autoComplete="country-name" required>
                  <option value="">Select a country…</option>
                  {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </label>
            </div>
          </section>

          <section className="checkout-step">
            <h3><span className="step-num">3</span> Delivery</h3>
            <div className="option-list">
              {methods === null && <p className="muted">Loading delivery options…</p>}
              {methods?.length === 0 && <p className="alert alert-error">No delivery methods are available right now.</p>}
              {methods?.map((d) => (
                <label key={d.id} className={`option-card ${form.shipping_method === d.code ? 'active' : ''}`}>
                  <input type="radio" name="shipping_method" value={d.code} checked={form.shipping_method === d.code} onChange={onChange} required />
                  <span className="option-text"><strong>{d.name}</strong>{d.description && <span className="muted small">{d.description}</span>}</span>
                  <strong>{Number(d.price) ? money(d.price) : 'Free'}</strong>
                </label>
              ))}
            </div>
          </section>

          <section className="checkout-step">
            <h3><span className="step-num">4</span> Payment</h3>
            <div className="option-list">
              <label className={`option-card ${payByCard ? 'active' : ''} ${cardEnabled ? '' : 'disabled'}`}>
                <input type="radio" name="payment_method" value="card" checked={payByCard} onChange={onChange} disabled={!cardEnabled} />
                <CardIcon />
                <span className="option-text">
                  <strong>Pay online with card</strong>
                  <span className="muted small">
                    {payments === null ? 'Checking…' : cardEnabled ? 'Visa, Mastercard, Amex · secure payment by Stripe' : 'Online payment is not available right now'}
                  </span>
                </span>
                <span className="card-logos"><span>VISA</span><span>MC</span><span>AMEX</span></span>
              </label>

              {/* Info slides open under the card option: the card itself is entered on Stripe's page */}
              <div className={`card-form ${payByCard ? 'open' : ''}`}>
                <div className="card-form-inner">
                <p className="demo-note">
                  <LockIcon width={16} height={16} /> After you place the order you are taken to Stripe's secure payment page.
                  Your card details go straight to Stripe — this shop never sees or stores them.
                  {payments?.testMode && <> Test mode: use card <code>4242 4242 4242 4242</code>, any future date, any CVC.</>}
                </p>
                </div>
              </div>

              <label className={`option-card ${!payByCard ? 'active' : ''}`}>
                <input type="radio" name="payment_method" value="cash" checked={!payByCard} onChange={onChange} />
                <CashIcon />
                <span className="option-text"><strong>Cash on delivery</strong><span className="muted small">Pay the courier when your order arrives</span></span>
              </label>
            </div>
          </section>

          <section className="checkout-step">
            <h3><span className="step-num">5</span> Order notes <span className="muted small">(optional)</span></h3>
            <textarea name="notes" rows="3" value={form.notes} onChange={onChange} placeholder="E.g. ring the bell twice, leave at the door…" maxLength={500} />
          </section>
        </div>

        <aside className="card summary checkout-summary">
          <h3>Order summary</h3>
          <div className="summary-items">
            {cart.items.map((i) => (
              <div key={i.key} className="summary-item">
                <span className="summary-thumb">
                  <img src={i.image_url} alt="" />
                  <span className="summary-qty">{i.quantity}</span>
                </span>
                <span className="grow">
                  <span className="summary-item-name">{i.name}</span>
                  {i.size && <span className="muted small">Size {i.size}</span>}
                </span>
                <span>{money(i.lineTotal)}</span>
              </div>
            ))}
          </div>
          <div className="summary-row"><span>Subtotal</span><span>{money(cart.subtotal)}</span></div>
          <div className="summary-row"><span>{delivery?.name || 'Delivery'}</span><span>{deliveryCost ? money(deliveryCost) : 'Free'}</span></div>
          <div className="summary-row total"><span>Total</span><span>{money(total)}</span></div>
          <button className="btn btn-primary btn-block btn-lg" disabled={submitting || !delivery}>
            {submitting
              ? payByCard ? 'Opening secure payment…' : 'Placing order…'
              : payByCard ? <><LockIcon width={16} height={16} /> Continue to payment · {money(total)}</> : `Place order · ${money(total)}`}
          </button>
          <p className="muted small center">
            {payByCard ? 'You pay on the next page (Stripe).' : 'You pay in cash when the order is delivered.'}
          </p>
        </aside>
      </form>
    </>
  );
}
