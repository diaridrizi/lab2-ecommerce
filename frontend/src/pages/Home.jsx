import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import HeroSlider from '../components/HeroSlider.jsx';
import ProductRow from '../components/ProductRow.jsx';
import Reveal from '../components/Reveal.jsx';
import { CashIcon, ShieldIcon, SparkIcon, TruckIcon } from '../components/Icons.jsx';

const CATEGORY_TILES = [
  { label: 'Sneakers', to: '/shop?category=sneakers', image: '/images/banners/cat-sneakers.jpg' },
  { label: 'Clothing', to: '/shop?category=clothing', image: '/images/banners/cat-clothing.jpg' },
  { label: 'Accessories', to: '/shop?category=accessories', image: '/images/banners/cat-accessories.jpg' },
  { label: 'Sale', to: '/shop?sale=1', image: '/images/banners/cat-sale.jpg', sale: true },
];

const USPS = [
  { icon: TruckIcon, title: 'Free shipping', text: 'Standard delivery, no minimum' },
  { icon: SparkIcon, title: 'New drops weekly', text: 'Fresh styles every week' },
  { icon: CashIcon, title: 'Card or cash', text: 'Pay online or on delivery' },
  { icon: ShieldIcon, title: 'Secure account', text: 'Track and cancel orders' },
];

export default function Home() {
  const [brands, setBrands] = useState([]);

  useEffect(() => {
    api.get('/brands').then(setBrands).catch(() => {});
  }, []);

  return (
    <>
      <HeroSlider />

      <Reveal as="section" className="usp-bar">
        <div className="container usp-grid">
          {USPS.map(({ icon: Icon, title, text }) => (
            <div key={title} className="usp">
              <Icon />
              <div><strong>{title}</strong><span>{text}</span></div>
            </div>
          ))}
        </div>
      </Reveal>

      <Reveal as="section" className="section container">
        <div className="section-head"><h2 className="section-title">Shop by category</h2></div>
        <div className="category-tiles">
          {CATEGORY_TILES.map((c, i) => (
            <Link key={c.label} to={c.to} className={`category-tile ${c.sale ? 'sale' : ''}`} style={{ '--i': i }}>
              <img src={c.image} alt="" loading="lazy" />
              <span className="category-tile-label">{c.label} <span className="arrow">→</span></span>
            </Link>
          ))}
        </div>
      </Reveal>

      <ProductRow title="New arrivals" query="sort=newest&limit=10" viewAllTo="/shop?sort=newest" />

      {brands.length > 0 && (
        <section className="brand-marquee" aria-label="Brands">
          {/* the list is rendered twice so the loop is seamless */}
          <div className="marquee-track">
            {[...brands, ...brands].map((b, i) => (
              <Link key={i} to={`/shop?brand=${encodeURIComponent(b.name)}`} className="marquee-item" tabIndex={i >= brands.length ? -1 : 0}>
                {b.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      <ProductRow title="Sale" query="sale=1&limit=10&sort=price_asc" viewAllTo="/shop?sale=1" />

      <Reveal as="section" className="section container">
        <div className="promo-banner">
          <img src="/images/banners/store.jpg" alt="" loading="lazy" />
          <div className="promo-content">
            <span className="slide-eyebrow">Members</span>
            <h2>Join FlowShop</h2>
            <p>Create a free account to save your cart, check out faster and track every order.</p>
            <Link to="/register" className="btn btn-light btn-lg">Create account</Link>
          </div>
        </div>
      </Reveal>

      <ProductRow title="Sneakers" query="category=sneakers&limit=10&sort=price_desc" viewAllTo="/shop?category=sneakers" />
    </>
  );
}
