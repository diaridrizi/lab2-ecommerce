import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, money } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';

export default function ProductDetail() {
  const { slug } = useParams();
  const { user } = useAuth();
  const { addItem } = useCart();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [qty, setQty] = useState(1);
  const [message, setMessage] = useState(null); // { type: 'success' | 'error', text }
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/products/${slug}`).then(setProduct).catch((e) => setError(e.message));
  }, [slug]);

  const handleAdd = async () => {
    if (!user) return navigate('/login', { state: { from: `/products/${slug}` } });
    try {
      await addItem(product.id, qty);
      setMessage({ type: 'success', text: `Added ${qty} × ${product.name} to your cart.` });
    } catch (e) {
      setMessage({ type: 'error', text: e.message });
    }
  };

  if (error) return <p className="alert alert-error">{error}</p>;
  if (!product) return <p className="muted">Loading…</p>;

  return (
    <>
      <Link to="/" className="back">← Back to shop</Link>
      <div className="detail">
        <img src={product.image_url || 'https://placehold.co/600x450?text=No+image'} alt={product.name} />
        <div>
          {product.category_name && <span className="tag">{product.category_name}</span>}
          <h1>{product.name}</h1>
          <p className="price">{money(product.price)}</p>
          <p>{product.description}</p>
          <p className="muted">{product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}</p>

          {product.stock > 0 && (
            <div className="add-row">
              <input
                type="number"
                min="1"
                max={product.stock}
                value={qty}
                onChange={(e) => setQty(Math.max(1, Math.min(product.stock, Number(e.target.value) || 1)))}
                aria-label="Quantity"
              />
              <button className="btn btn-primary" onClick={handleAdd}>Add to cart</button>
            </div>
          )}
          {message && (
            <p className={`alert alert-${message.type}`}>
              {message.text} {message.type === 'success' && <Link to="/cart">View cart →</Link>}
            </p>
          )}
        </div>
      </div>
    </>
  );
}
