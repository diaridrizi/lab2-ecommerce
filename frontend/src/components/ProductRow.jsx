import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import ProductCard from './ProductCard.jsx';
import Reveal from './Reveal.jsx';
import { ArrowLeft, ArrowRight } from './Icons.jsx';

// Horizontal, swipeable row of products with arrow buttons (used on the homepage)
export default function ProductRow({ title, query, viewAllTo }) {
  const [items, setItems] = useState(null);
  const trackRef = useRef(null);

  useEffect(() => {
    api.get(`/products?${query}`).then((d) => setItems(d.items)).catch(() => setItems([]));
  }, [query]);

  const scroll = (dir) => {
    const track = trackRef.current;
    track.scrollBy({ left: dir * track.clientWidth * 0.8, behavior: 'smooth' });
  };

  if (items && items.length === 0) return null;

  return (
    <Reveal as="section" className="section container">
      <div className="section-head">
        <h2 className="section-title">{title}</h2>
        <div className="section-actions">
          {viewAllTo && <Link to={viewAllTo} className="link-underline">View all</Link>}
          <button className="icon-btn round" onClick={() => scroll(-1)} aria-label="Scroll left"><ArrowLeft /></button>
          <button className="icon-btn round" onClick={() => scroll(1)} aria-label="Scroll right"><ArrowRight /></button>
        </div>
      </div>
      <div className="row-track" ref={trackRef}>
        {items
          ? items.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)
          : Array.from({ length: 4 }, (_, i) => <div key={i} className="product-card skeleton-card"><div className="skeleton skeleton-img" /></div>)}
      </div>
    </Reveal>
  );
}
