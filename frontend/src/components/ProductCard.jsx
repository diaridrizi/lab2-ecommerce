import { Link } from 'react-router-dom';
import { money } from '../api.js';

export default function ProductCard({ product }) {
  return (
    <Link to={`/products/${product.slug}`} className="card product-card">
      <img src={product.image_url || 'https://placehold.co/600x450?text=No+image'} alt={product.name} loading="lazy" />
      <div className="product-card-body">
        {product.category_name && <span className="tag">{product.category_name}</span>}
        <h3>{product.name}</h3>
        <div className="product-card-footer">
          <strong>{money(product.price)}</strong>
          {product.stock === 0 ? (
            <span className="stock out">Out of stock</span>
          ) : product.stock <= 5 ? (
            <span className="stock low">Only {product.stock} left</span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
