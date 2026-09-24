import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { money } from '../api.js';
import { useCart } from '../context/CartContext.jsx';
import QtyStepper from './QtyStepper.jsx';
import { CloseIcon, TrashIcon } from './Icons.jsx';

// Slide-in mini cart. Opens after "Add to cart" and from the bag icon in the header.
export default function CartDrawer() {
  const { cart, drawerOpen, closeDrawer, updateItem, removeItem } = useCart();
  const location = useLocation();
  const [busyKey, setBusyKey] = useState(null);
  const [error, setError] = useState('');

  // Close when the page changes or Escape is pressed; stop the page behind from scrolling
  useEffect(() => closeDrawer(), [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e) => e.key === 'Escape' && closeDrawer();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [drawerOpen]); // eslint-disable-line react-hooks/exhaustive-deps

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

  return (
    <>
      <div className={`drawer-backdrop ${drawerOpen ? 'open' : ''}`} onClick={closeDrawer} />
      <aside className={`cart-drawer ${drawerOpen ? 'open' : ''}`} aria-hidden={!drawerOpen} aria-label="Cart">
        <div className="cart-drawer-head">
          <h2>Cart <span className="muted">(items: {cart.count})</span></h2>
          <button className="icon-btn" onClick={closeDrawer} aria-label="Close cart"><CloseIcon /></button>
        </div>

        {error && <p className="alert alert-error cart-drawer-alert">{error}</p>}

        {cart.items.length === 0 ? (
          <div className="cart-drawer-empty">
            <p>Your cart is empty.</p>
            <Link to="/shop" className="btn btn-primary" onClick={closeDrawer}>Start shopping</Link>
          </div>
        ) : (
          <>
            <div className="cart-drawer-items">
              {cart.items.map((item, i) => (
                <div key={item.key} className={`mini-item ${busyKey === item.key ? 'busy' : ''}`} style={{ '--i': i }}>
                  <Link to={`/products/${item.slug}`} className="mini-item-img"><img src={item.image_url} alt="" /></Link>
                  <div className="mini-item-info">
                    <div className="mini-item-top">
                      <Link to={`/products/${item.slug}`} className="mini-item-name">{item.name}</Link>
                      <strong>{money(item.lineTotal)}</strong>
                    </div>
                    <span className="muted">{money(item.price)}</span>
                    {item.size && <span className="mini-item-size">Size: <strong>{item.size}</strong></span>}
                    <div className="mini-item-actions">
                      <QtyStepper
                        small
                        value={item.quantity}
                        max={item.stock}
                        disabled={busyKey === item.key}
                        onChange={(q) => run(item.key, () => updateItem(item.productId, item.size, q))}
                        label={`quantity of ${item.name}`}
                      />
                      <button
                        className="icon-btn"
                        onClick={() => run(item.key, () => removeItem(item.productId, item.size))}
                        aria-label={`Remove ${item.name}`}
                      >
                        <TrashIcon width={20} height={20} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="cart-drawer-foot">
              <div className="summary-row total"><span>Subtotal</span><span>{money(cart.subtotal)}</span></div>
              <p className="muted small">Delivery and payment are chosen at checkout.</p>
              <Link to="/checkout" className="btn btn-primary btn-block btn-lg">Go to checkout</Link>
              <Link to="/cart" className="btn btn-block btn-lg">View cart</Link>
              <button className="link-underline continue" onClick={closeDrawer}>Continue shopping</button>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
