import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import ProductCard from '../components/ProductCard.jsx';

export default function Home() {
  // Filters live in the URL (?search=&category=&sort=&page=) so they survive a refresh
  const [params, setParams] = useSearchParams();
  const [categories, setCategories] = useState([]);
  const [data, setData] = useState({ items: [], total: 0, page: 1, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchInput, setSearchInput] = useState(params.get('search') || '');

  useEffect(() => {
    api.get('/categories').then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    api
      .get(`/products?${params.toString()}`)
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

  const onSearch = (e) => {
    e.preventDefault();
    setParam('search', searchInput.trim());
  };

  const activeCategory = params.get('category') || '';
  const page = Number(params.get('page')) || 1;

  return (
    <>
      <section className="hero">
        <h1>Everything you need, in one place</h1>
        <p className="muted">Browse {data.total} products across {categories.length} categories.</p>
        <form className="search" onSubmit={onSearch}>
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search products…"
            aria-label="Search products"
          />
          <button className="btn btn-primary">Search</button>
        </form>
      </section>

      <div className="toolbar">
        <div className="chips">
          <button className={`chip ${!activeCategory ? 'active' : ''}`} onClick={() => setParam('category', '')}>
            All
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              className={`chip ${activeCategory === c.slug ? 'active' : ''}`}
              onClick={() => setParam('category', c.slug)}
            >
              {c.name} <span className="muted">({c.product_count})</span>
            </button>
          ))}
        </div>
        <select value={params.get('sort') || 'newest'} onChange={(e) => setParam('sort', e.target.value)}>
          <option value="newest">Newest</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
          <option value="name">Name A–Z</option>
        </select>
      </div>

      {error && <p className="alert alert-error">{error}</p>}
      {loading ? (
        <p className="muted">Loading products…</p>
      ) : data.items.length === 0 ? (
        <p className="empty">No products found.</p>
      ) : (
        <div className="grid">
          {data.items.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      )}

      {data.pages > 1 && (
        <div className="pagination">
          <button className="btn" disabled={page <= 1} onClick={() => setParam('page', String(page - 1))}>
            ← Prev
          </button>
          <span>Page {page} of {data.pages}</span>
          <button className="btn" disabled={page >= data.pages} onClick={() => setParam('page', String(page + 1))}>
            Next →
          </button>
        </div>
      )}
    </>
  );
}
