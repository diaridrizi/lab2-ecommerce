import { money } from '../api.js';

export const isOnSale = (p) => p.compare_at_price != null && p.compare_at_price > p.price;
export const discountPercent = (p) => Math.round((1 - p.price / p.compare_at_price) * 100);
// Products added in the last 14 days get a "New" badge
export const isNew = (p) => p.created_at && Date.now() - new Date(p.created_at) < 14 * 24 * 3600 * 1000;

// Shows the price, and the crossed-out old price when the product is on sale
export default function Price({ product, className = '' }) {
  if (!isOnSale(product)) return <span className={`price-now ${className}`}>{money(product.price)}</span>;
  return (
    <span className={`price-group ${className}`}>
      <span className="price-now sale">{money(product.price)}</span>
      <s className="price-was">{money(product.compare_at_price)}</s>
    </span>
  );
}
