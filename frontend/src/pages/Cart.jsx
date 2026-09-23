import { useState } from 'react';
import { Link } from 'react-router-dom';
import { money } from '../api.js';
import { useCart } from '../context/CartContext.jsx';

export default function Cart() {
  const { cart, updateItem, removeItem } = useCart();
  const [error, setError] = useState('');

  const run = async (fn) => {
    try {
      setError('');
      await fn();
    } catch (e) {
      setError(e.message);
    }
  };

  if (cart.items.length === 0) {
    return (
      <div className="empty">
        <h2>Your cart is empty</h2>
        <Link to="/" className="btn btn-primary">Start shopping</Link>
      </div>
    );
  }

  return (
    <>
      <h1>Your cart</h1>
      {error && <p className="alert alert-error">{error}</p>}
      <div className="cart-layout">
        <div className="card">
          {cart.items.map((item) => (
            <div key={item.productId} className="cart-row">
              <img src={item.image_url} alt="" />
              <div className="grow">
                <Link to={`/products/${item.slug}`}><strong>{item.name}</strong></Link>
                <div className="muted">{money(item.price)} each</div>
              </div>
              <input
                type="number"
                min="1"
                max={item.stock}
                value={item.quantity}
                onChange={(e) => {
                  const q = Number(e.target.value);
                  if (q >= 1) run(() => updateItem(item.productId, q));
                }}
                aria-label={`Quantity of ${item.name}`}
              />
              <strong className="line-total">{money(item.lineTotal)}</strong>
              <button className="btn btn-ghost" onClick={() => run(() => removeItem(item.productId))}>
                Remove
              </button>
            </div>
          ))}
        </div>
        <aside className="card summary">
          <h3>Summary</h3>
          <div className="summary-row"><span>Items</span><span>{cart.count}</span></div>
          <div className="summary-row"><span>Shipping</span><span>Free</span></div>
          <div className="summary-row total"><span>Total</span><span>{money(cart.subtotal)}</span></div>
          <Link to="/checkout" className="btn btn-primary btn-block">Checkout</Link>
        </aside>
      </div>
    </>
  );
}
