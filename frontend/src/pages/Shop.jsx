import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import ProductCard from '../components/ProductCard.jsx';

export default function Shop() {
  // Filters live in the URL (?search=&category=&brand=&sale=&sort=&page=) so they survive a refresh
  const [params, setParams] = useSearchParams();
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [data, setData] = useState({ items: [], total: 0, page: 1, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/categories').then(setCategories).catch(() => {});
    api.get('/brands').then(setBrands).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const q = new URLSearchParams(params);
    q.set('limit', '12');
    api
      .get(`/products?${q.toString()}`)
      .then((d) => { setData(d); setError(''); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [params]);

  const setParam = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page'); // go back to page 1 when filters change
    setParams(next);
  };

  const category = params.get('category') || '';
  const brand = params.get('brand') || '';
  const search = params.get('search') || '';
  const sale = params.get('sale') === '1';
  const page = Number(params.get('page')) || 1;

  // Page title based on the active filters
  const categoryName = categories.find((c) => c.slug === category)?.name;
  const title = search ? `Results for “${search}”` : sale ? 'Sale' : brand || categoryName || (params.get('sort') === 'newest' ? 'New arrivals' : 'All products');

  return (
    <>
      <nav className="breadcrumbs">
        <Link to="/">Home</Link> <span>/</span> <span>{title}</span>
      </nav>
      <div className="shop-head">
        <h1 className={sale ? 'sale-text' : ''}>{title}</h1>
        <span className="muted">{data.total} products</span>
      </div>

      <div className="toolbar">
        <div className="chips">
          <button className={`chip ${!category ? 'active' : ''}`} onClick={() => setParam('category', '')}>All</button>
          {categories.map((c) => (
            <button key={c.id} className={`chip ${category === c.slug ? 'active' : ''}`} onClick={() => setParam('category', c.slug)}>
              {c.name}
            </button>
          ))}
          <button className={`chip chip-sale ${sale ? 'active' : ''}`} onClick={() => setParam('sale', sale ? '' : '1')}>
            Sale
          </button>
        </div>
        <div className="toolbar-selects">
          <select value={brand} onChange={(e) => setParam('brand', e.target.value)} aria-label="Brand">
            <option value="">All brands</option>
            {brands.map((b) => <option key={b.name} value={b.name}>{b.name}</option>)}
          </select>
          <select value={params.get('sort') || 'newest'} onChange={(e) => setParam('sort', e.target.value)} aria-label="Sort">
            <option value="newest">Newest</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
            <option value="name">Name A–Z</option>
          </select>
        </div>
      </div>

      {(search || brand) && (
        <div className="active-filters">
          {search && <button className="filter-pill" onClick={() => setParam('search', '')}>Search: {search} ✕</button>}
          {brand && <button className="filter-pill" onClick={() => setParam('brand', '')}>Brand: {brand} ✕</button>}
        </div>
      )}

      {error && <p className="alert alert-error">{error}</p>}
      {loading ? (
        <div className="grid" aria-label="Loading products">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="product-card skeleton-card">
              <div className="skeleton skeleton-img" />
              <div className="skeleton-body">
                <div className="skeleton skeleton-line w-40" />
                <div className="skeleton skeleton-line w-70" />
                <div className="skeleton skeleton-line w-30" />
              </div>
            </div>
          ))}
        </div>
      ) : data.items.length === 0 ? (
        <div className="empty">
          <h2>No products found</h2>
          <p>Try another filter or search term.</p>
          <Link to="/shop" className="btn btn-primary">Clear filters</Link>
        </div>
      ) : (
        <div className="grid stagger">
          {data.items.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
        </div>
      )}

      {data.pages > 1 && (
        <div className="pagination">
          <button className="btn" disabled={page <= 1} onClick={() => setParam('page', String(page - 1))}>← Prev</button>
          <span>Page {page} of {data.pages}</span>
          <button className="btn" disabled={page >= data.pages} onClick={() => setParam('page', String(page + 1))}>Next →</button>
        </div>
      )}
    </>
  );
}
