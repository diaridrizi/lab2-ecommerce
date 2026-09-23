import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { api, money } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';

export default function Checkout() {
  const { user } = useAuth();
  const { cart, clear } = useCart();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    shipping_name: user?.name || '',
    shipping_address: '',
    shipping_city: '',
    shipping_phone: '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (cart.items.length === 0 && !submitting) return <Navigate to="/cart" replace />;

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const order = await api.post('/orders', form);
      clear();
      navigate(`/orders/${order.id}`, { state: { justPlaced: true } });
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <>
      <h1>Checkout</h1>
      <div className="cart-layout">
        <form className="card form" onSubmit={onSubmit}>
          <h3>Shipping details</h3>
          {error && <p className="alert alert-error">{error}</p>}
          <label>Full name<input name="shipping_name" value={form.shipping_name} onChange={onChange} required /></label>
          <label>Address<input name="shipping_address" value={form.shipping_address} onChange={onChange} required /></label>
          <label>City<input name="shipping_city" value={form.shipping_city} onChange={onChange} required /></label>
          <label>Phone<input name="shipping_phone" value={form.shipping_phone} onChange={onChange} required /></label>
          <p className="muted small">Payment is cash on delivery (no real payment in this demo).</p>
          <button className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? 'Placing order…' : `Place order · ${money(cart.subtotal)}`}
          </button>
        </form>
        <aside className="card summary">
          <h3>Order summary</h3>
          {cart.items.map((i) => (
            <div key={i.productId} className="summary-row">
              <span>{i.quantity} × {i.name}</span>
              <span>{money(i.lineTotal)}</span>
            </div>
          ))}
          <div className="summary-row total"><span>Total</span><span>{money(cart.subtotal)}</span></div>
        </aside>
      </div>
    </>
  );
}
