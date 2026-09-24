import { Link } from 'react-router-dom';
import Price, { discountPercent, isNew, isOnSale } from './Price.jsx';

export default function ProductCard({ product, index = 0 }) {
  const soldOut = product.stock === 0;

  return (
    <Link to={`/products/${product.slug}`} className="product-card" style={{ '--i': index }}>
      <div className="product-card-media">
        <img src={product.image_url || 'https://placehold.co/800x800?text=No+image'} alt={product.name} loading="lazy" />
        <div className="product-badges">
          {isOnSale(product) && <span className="pbadge pbadge-sale">-{discountPercent(product)}%</span>}
          {isNew(product) && <span className="pbadge">New</span>}
          {soldOut && <span className="pbadge pbadge-muted">Sold out</span>}
        </div>
        <span className="product-card-cta">View product</span>
      </div>
      <div className="product-card-body">
        {product.brand && <span className="product-brand">{product.brand}</span>}
        <h3>{product.name}</h3>
        <Price product={product} />
        {!soldOut && product.stock <= 5 && <span className="stock low">Only {product.stock} left</span>}
      </div>
    </Link>
  );
}
