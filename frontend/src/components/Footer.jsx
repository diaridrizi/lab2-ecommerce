import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../api.js';

export default function Footer() {
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(''); // thank-you message from the API
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    const load = () => api.get('/categories').then(setCategories).catch(() => {});
    load();
    window.addEventListener('categories-changed', load);
    return () => window.removeEventListener('categories-changed', load);
  }, [location.pathname]);

  // Saves the email in MongoDB (Admin → Subscribers)
  const onSubscribe = async (e) => {
    e.preventDefault();
    setSending(true);
    setError('');
    try {
      const res = await api.post('/newsletter', { email });
      setSubscribed(res.message);
      setEmail('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <footer className="site-footer">
      <div className="container footer-newsletter">
        <div>
          <h3>Stay in the loop</h3>
          <p>New drops, restocks and sales — straight to your inbox.</p>
        </div>
        {subscribed ? (
          <p className="newsletter-thanks">{subscribed}</p>
        ) : (
          <div>
            <form className="newsletter-form" onSubmit={onSubscribe}>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Your email address" required aria-label="Email" />
              <button className="btn btn-light" disabled={sending}>{sending ? 'Sending…' : 'Subscribe'}</button>
            </form>
            {error && <p className="newsletter-error">{error}</p>}
          </div>
        )}
      </div>

      <div className="container footer-cols">
        <div>
          <Link to="/" className="logo logo-light">FLOW<span>SHOP</span></Link>
          <p className="footer-about">Sneakers, streetwear and accessories from the brands you love.</p>
        </div>
        <div>
          <h4>Shop</h4>
          <Link to="/shop?sort=newest">New arrivals</Link>
          {categories.map((c) => <Link key={c.id} to={`/shop?category=${c.slug}`}>{c.name}</Link>)}
          <Link to="/shop?sale=1">Sale</Link>
        </div>
        <div>
          <h4>Account</h4>
          <Link to="/login">Log in</Link>
          <Link to="/register">Create account</Link>
          <Link to="/orders">My orders</Link>
          <Link to="/cart">Cart</Link>
        </div>
        <div>
          <h4>Service</h4>
          <span>Free standard shipping</span>
          <span>Express delivery in 1–2 days</span>
          <span>Pay by card or cash on delivery</span>
          <span>Cancel before shipping</span>
        </div>
      </div>

      <div className="footer-bottom">
        <div className="container footer-bottom-inner">
          <span>© {new Date().getFullYear()} FlowShop · Lab Course 2</span>
          <span>React + Express + PostgreSQL + MongoDB · Photos: Unsplash</span>
        </div>
      </div>
    </footer>
  );
}
