import { useState } from 'react';
import { Link } from 'react-router-dom';
import { money } from '../api.js';
import { useCart } from '../context/CartContext.jsx';
import QtyStepper from '../components/QtyStepper.jsx';
import { CardIcon, CashIcon, TrashIcon, TruckIcon } from '../components/Icons.jsx';

export default function Cart() {
  const { cart, loaded, updateItem, removeItem } = useCart();
  const [error, setError] = useState('');
  const [busyKey, setBusyKey] = useState(null);

  const run = async (key, fn) => {
    setBusyKey(key);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyKey(null);
    }
  };

  if (!loaded) return <p className="muted">Loading…</p>;
  if (cart.items.length === 0) {
    return (
      <div className="empty">
        <h2>Your cart is empty</h2>
        <p>Find something you love and it will show up here.</p>
        <Link to="/shop" className="btn btn-primary">Start shopping</Link>
      </div>
    );
  }

  return (
    <>
      <div className="shop-head">
        <h1>Your cart</h1>
        <span className="muted">{cart.count} {cart.count === 1 ? 'item' : 'items'}</span>
      </div>
      {error && <p className="alert alert-error">{error}</p>}
      <div className="cart-layout">
        <div className="stagger">
          {cart.items.map((item, i) => (
            <div key={item.key} className={`cart-row ${busyKey === item.key ? 'busy' : ''}`} style={{ '--i': i }}>
              <Link to={`/products/${item.slug}`}><img src={item.image_url} alt="" /></Link>
              <div className="grow">
                {item.brand && <span className="product-brand">{item.brand}</span>}
                <Link to={`/products/${item.slug}`} className="cart-name">{item.name}</Link>
                <div className="muted small">
                  {money(item.price)} each{item.size && <> · Size <strong className="text">{item.size}</strong></>}
                </div>
                {item.stock <= 3 && <span className="stock low">Only {item.stock} left</span>}
              </div>
              <QtyStepper
                small
                value={item.quantity}
                max={item.stock}
                disabled={busyKey === item.key}
                onChange={(q) => run(item.key, () => updateItem(item.productId, item.size, q))}
                label={`quantity of ${item.name}`}
              />
              <strong className="line-total">{money(item.lineTotal)}</strong>
              <button className="icon-btn" onClick={() => run(item.key, () => removeItem(item.productId, item.size))} aria-label={`Remove ${item.name}`}>
                <TrashIcon width={20} height={20} />
              </button>
            </div>
          ))}
        </div>
        <aside className="card summary">
          <h3>Summary</h3>
          <div className="summary-row"><span>Subtotal</span><span>{money(cart.subtotal)}</span></div>
          <div className="summary-row"><span>Delivery</span><span>From free</span></div>
          <div className="summary-row total"><span>Total</span><span>{money(cart.subtotal)}</span></div>
          <Link to="/checkout" className="btn btn-primary btn-block btn-lg">Go to checkout</Link>
          <Link to="/shop" className="btn btn-block">Continue shopping</Link>
          <ul className="summary-perks">
            <li><TruckIcon width={18} height={18} /> Free standard delivery</li>
            <li><CardIcon width={18} height={18} /> Pay by card</li>
            <li><CashIcon width={18} height={18} /> or cash on delivery</li>
          </ul>
        </aside>
      </div>
    </>
  );
}
