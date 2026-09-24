import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { BagIcon, CloseIcon, MenuIcon, SearchIcon, UserIcon } from './Icons.jsx';
import NotificationBell from './NotificationBell.jsx';

const ANNOUNCEMENTS = ['Free standard shipping on all orders', 'New drops every week', 'Pay by card or cash on delivery'];

// Main menu: New, then one link per category from the database, then Brands and Sale.
// `match` decides when a link is highlighted (they all point to /shop with different filters)
const buildMenu = (categories) => [
  { label: 'New', to: '/shop?sort=newest', match: (p) => p.get('sort') === 'newest' && !p.get('category') },
  ...categories.map((c) => ({
    label: c.name,
    to: `/shop?category=${c.slug}`,
    match: (p) => p.get('category') === c.slug,
  })),
  { label: 'Brands', to: '/shop', brands: true, match: (p) => !!p.get('brand') },
  { label: 'Sale', to: '/shop?sale=1', sale: true, match: (p) => p.get('sale') === '1' },
];

function AnnouncementBar() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % ANNOUNCEMENTS.length), 4000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="announcement">
      <span key={i} className="announcement-text">{ANNOUNCEMENTS[i]}</span>
    </div>
  );
}

export default function Navbar() {
  const { user, isAdmin, logout } = useAuth();
  const { cart, openDrawer } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [term, setTerm] = useState('');
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const searchRef = useRef(null);

  // Reload on every page change and when the admin edits categories, so new ones show up right away
  useEffect(() => {
    const loadMenu = () => {
      api.get('/categories').then(setCategories).catch(() => {});
      api.get('/brands').then(setBrands).catch(() => {});
    };
    loadMenu();
    window.addEventListener('categories-changed', loadMenu);
    return () => window.removeEventListener('categories-changed', loadMenu);
  }, [location.pathname]);

  const MENU = buildMenu(categories);

  // Add a shadow under the header once the page is scrolled
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close menus when the page changes
  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  const onSearch = (e) => {
    e.preventDefault();
    if (!term.trim()) return;
    navigate(`/shop?search=${encodeURIComponent(term.trim())}`);
    setTerm('');
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const onShop = location.pathname === '/shop';

  return (
    <>
      <AnnouncementBar />
      <header className={`header ${scrolled ? 'scrolled' : ''}`}>
        <div className="container header-inner">
          <button className="icon-btn show-sm" onClick={() => setMenuOpen(true)} aria-label="Open menu"><MenuIcon /></button>

          <Link to="/" className="logo">FLOW<span>SHOP</span></Link>

          <nav className="main-nav hide-sm">
            {MENU.map((m) => (
              <div key={m.label} className={`nav-item ${m.brands ? 'has-dropdown' : ''}`}>
                <Link to={m.to} className={`nav-link ${m.sale ? 'sale' : ''} ${onShop && m.match(params) ? 'active' : ''}`}>
                  {m.label}
                </Link>
                {m.brands && brands.length > 0 && (
                  <div className="dropdown">
                    <div className="dropdown-grid">
                      {brands.map((b) => (
                        <Link key={b.name} to={`/shop?brand=${encodeURIComponent(b.name)}`}>
                          {b.name} <span className="muted">{b.product_count}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </nav>

          <div className="header-icons">
            <button className="icon-btn" onClick={() => setSearchOpen((o) => !o)} aria-label="Search">
              {searchOpen ? <CloseIcon /> : <SearchIcon />}
            </button>
            {user && <NotificationBell />}
            <div className="nav-item has-dropdown account">
              <Link to={user ? '/orders' : '/login'} className="icon-btn" aria-label="Account"><UserIcon /></Link>
              <div className="dropdown dropdown-right">
                {user ? (
                  <>
                    <p className="dropdown-title">Hi, {user.name}</p>
                    <NavLink to="/orders">My orders</NavLink>
                    <NavLink to="/account">Account &amp; security</NavLink>
                    {isAdmin && <NavLink to="/admin">Admin panel</NavLink>}
                    <button className="link-plain" onClick={handleLogout}>Log out</button>
                  </>
                ) : (
                  <>
                    <Link to="/login" className="btn btn-primary btn-block">Log in</Link>
                    <Link to="/register" className="btn btn-block">Create account</Link>
                  </>
                )}
              </div>
            </div>
            <Link
              to="/cart"
              className="icon-btn cart-btn"
              aria-label="Cart"
              onClick={(e) => {
                // Logged in: open the mini cart instead of leaving the page
                if (!user) return;
                e.preventDefault();
                openDrawer();
              }}
            >
              <BagIcon />
              {cart.count > 0 && <span key={cart.count} className="badge">{cart.count}</span>}
            </Link>
          </div>
        </div>

        <div className={`search-panel ${searchOpen ? 'open' : ''}`}>
          <form className="container search-form" onSubmit={onSearch}>
            <SearchIcon />
            <input
              ref={searchRef}
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search for products, brands…"
              aria-label="Search"
              tabIndex={searchOpen ? 0 : -1}
            />
            <button className="btn btn-primary" tabIndex={searchOpen ? 0 : -1}>Search</button>
          </form>
        </div>
      </header>

      {/* Mobile slide-in menu */}
      <div className={`drawer-backdrop ${menuOpen ? 'open' : ''}`} onClick={() => setMenuOpen(false)} />
      <aside className={`drawer ${menuOpen ? 'open' : ''}`} aria-hidden={!menuOpen}>
        <div className="drawer-head">
          <span className="logo">FLOW<span>SHOP</span></span>
          <button className="icon-btn" onClick={() => setMenuOpen(false)} aria-label="Close menu"><CloseIcon /></button>
        </div>
        {MENU.map((m) => (
          <Link key={m.label} to={m.to} className={`drawer-link ${m.sale ? 'sale' : ''}`}>{m.label}</Link>
        ))}
        <div className="drawer-foot">
          {user ? (
            <>
              <Link to="/orders" className="drawer-link small">My orders</Link>
              <Link to="/account" className="drawer-link small">Account &amp; security</Link>
              {isAdmin && <Link to="/admin" className="drawer-link small">Admin panel</Link>}
              <button className="drawer-link small link-plain" onClick={handleLogout}>Log out</button>
            </>
          ) : (
            <>
              <Link to="/login" className="drawer-link small">Log in</Link>
              <Link to="/register" className="drawer-link small">Create account</Link>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
