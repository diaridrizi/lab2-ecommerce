import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import Price, { discountPercent, isNew, isOnSale } from '../components/Price.jsx';
import ProductRow from '../components/ProductRow.jsx';
import Reviews from '../components/Reviews.jsx';
import QtyStepper from '../components/QtyStepper.jsx';
import { CardIcon, CashIcon, TruckIcon } from '../components/Icons.jsx';

const LOW_STOCK = 2; // sizes with this many or fewer get the "only a few left" dot

export default function ProductDetail() {
  const { slug } = useParams();
  const { user } = useAuth();
  const { addItem, openDrawer } = useCart();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [size, setSize] = useState(null);
  const [qty, setQty] = useState(1);
  const [adding, setAdding] = useState(false);
  const [sizeError, setSizeError] = useState(0); // counter, so the shake animation replays
  const [message, setMessage] = useState(null); // { id, type, text }
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/products/${slug}`).then(setProduct).catch((e) => setError(e.message));
  }, [slug]);

  const hasSizes = product?.sizes?.length > 0;
  const selected = hasSizes ? product.sizes.find((s) => s.size === size) : null;
  const available = hasSizes ? selected?.stock ?? 0 : product?.stock ?? 0;
  const anyLowSize = hasSizes && product.sizes.some((s) => s.stock > 0 && s.stock <= LOW_STOCK);

  const chooseSize = (s) => {
    setSize(s.size);
    setQty((q) => Math.min(q, s.stock)); // don't allow more than this size has
    setMessage(null);
  };

  const handleAdd = async () => {
    if (!user) return navigate('/login', { state: { from: `/products/${slug}` } });
    if (hasSizes && !size) {
      setSizeError((n) => n + 1);
      setMessage({ id: Date.now(), type: 'error', text: 'Please choose a size first.' });
      return;
    }
    setAdding(true);
    setMessage(null);
    try {
      await addItem(product.id, qty, size);
      openDrawer();
    } catch (e) {
      setMessage({ id: Date.now(), type: 'error', text: e.message });
    } finally {
      setAdding(false);
    }
  };

  if (error) return <p className="alert alert-error">{error}</p>;
  if (!product) {
    return (
      <div className="detail">
        <div className="skeleton detail-skeleton" />
        <div className="skeleton-body">
          <div className="skeleton skeleton-line w-30" />
          <div className="skeleton skeleton-line w-70" />
          <div className="skeleton skeleton-line w-40" />
        </div>
      </div>
    );
  }

  const soldOut = product.stock === 0;
  const sizeSystem = product.category_slug === 'sneakers' ? 'EU' : null;

  return (
    <>
      <nav className="breadcrumbs">
        <Link to="/">Home</Link> <span>/</span>{' '}
        {product.category_slug && <><Link to={`/shop?category=${product.category_slug}`}>{product.category_name}</Link> <span>/</span>{' '}</>}
        {product.brand && <><Link to={`/shop?brand=${encodeURIComponent(product.brand)}`}>{product.brand}</Link> <span>/</span>{' '}</>}
        <span>{product.name}</span>
      </nav>

      <div className="detail">
        <div className="detail-media">
          <img src={product.image_url || 'https://placehold.co/800x800?text=No+image'} alt={product.name} />
          <div className="product-badges">
            {isOnSale(product) && <span className="pbadge pbadge-sale">-{discountPercent(product)}%</span>}
            {isNew(product) && <span className="pbadge">New</span>}
          </div>
        </div>

        <div className="detail-info">
          {product.brand && (
            <Link to={`/shop?brand=${encodeURIComponent(product.brand)}`} className="product-brand">{product.brand}</Link>
          )}
          <h1>{product.name}</h1>
          <Price product={product} className="price-lg" />
          {isOnSale(product) && <p className="save-note">You save {discountPercent(product)}%</p>}

          {hasSizes && (
            <div className="size-picker">
              <div className="size-picker-head">
                <span className="size-label">Size{sizeSystem && <> · {sizeSystem}</>}</span>
                {selected && <span className="muted small">{selected.stock <= LOW_STOCK ? `Only ${selected.stock} left in ${selected.size}` : `${selected.size} in stock`}</span>}
              </div>
              <div key={sizeError} className={`size-grid ${sizeError ? 'shake' : ''}`} role="radiogroup" aria-label="Size">
                {product.sizes.map((s) => (
                  <button
                    key={s.size}
                    type="button"
                    role="radio"
                    aria-checked={size === s.size}
                    className={`size-btn ${size === s.size ? 'active' : ''} ${s.stock === 0 ? 'sold-out' : ''}`}
                    disabled={s.stock === 0}
                    onClick={() => chooseSize(s)}
                    title={s.stock === 0 ? 'Sold out' : s.stock <= LOW_STOCK ? 'Only a few left' : undefined}
                  >
                    {s.size}
                    {s.stock > 0 && s.stock <= LOW_STOCK && <span className="size-dot" />}
                  </button>
                ))}
              </div>
              {anyLowSize && <p className="size-legend"><span className="size-dot" /> Only a few left</p>}
            </div>
          )}

          <p className={`stock-line ${soldOut ? 'out' : product.stock <= 5 ? 'low' : ''}`}>
            <span className="dot" />
            {soldOut ? 'Sold out' : product.stock <= 5 ? `Only ${product.stock} left — order soon` : 'In stock, ready to ship'}
          </p>

          {!soldOut && (
            <div className="add-row">
              <QtyStepper value={qty} max={Math.max(1, available)} onChange={setQty} disabled={hasSizes && !size} />
              <button className="btn btn-primary btn-lg grow" onClick={handleAdd} disabled={adding}>
                {adding ? 'Adding…' : hasSizes && !size ? 'Select a size' : 'Add to cart'}
              </button>
            </div>
          )}
          {message && <p key={message.id} className={`alert alert-${message.type}`}>{message.text}</p>}

          <div className="detail-section">
            <h4>Description</h4>
            <p>{product.description}</p>
          </div>
          <ul className="detail-perks">
            <li><TruckIcon /> Free standard delivery · Express in 1–2 days</li>
            <li><CardIcon /> Pay securely by card</li>
            <li><CashIcon /> Or pay cash on delivery</li>
          </ul>
        </div>
      </div>

      <Reviews productId={product.id} />

      {product.category_slug && (
        <ProductRow title="You may also like" query={`category=${product.category_slug}&limit=10`} viewAllTo={`/shop?category=${product.category_slug}`} />
      )}
    </>
  );
}
