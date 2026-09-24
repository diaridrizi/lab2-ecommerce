import { NavLink, Outlet } from 'react-router-dom';

// Admin sections. `db` shows which database each CRUD uses (handy for the presentation).
const SECTIONS = [
  { title: 'Shop', links: [
    { to: '/admin', label: 'Dashboard', end: true },
    { to: '/admin/products', label: 'Products', db: 'PG' },
    { to: '/admin/categories', label: 'Categories', db: 'PG' },
    { to: '/admin/delivery', label: 'Delivery', db: 'PG' },
  ] },
  { title: 'Orders & customers', links: [
    { to: '/admin/orders', label: 'Orders', db: 'PG' },
    { to: '/admin/users', label: 'Users', db: 'PG' },
    { to: '/admin/reviews', label: 'Reviews', db: 'Mongo' },
    { to: '/admin/subscribers', label: 'Subscribers', db: 'Mongo' },
  ] },
  { title: 'Content', links: [
    { to: '/admin/banners', label: 'Banners', db: 'Mongo' },
  ] },
];

export default function AdminLayout() {
  return (
    <div className="admin">
      <aside className="admin-nav">
        {SECTIONS.map((s) => (
          <div key={s.title} className="admin-nav-group">
            <h3>{s.title}</h3>
            {s.links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end}>
                {l.label}
                {l.db && <span className={`db-tag ${l.db === 'Mongo' ? 'mongo' : ''}`}>{l.db}</span>}
              </NavLink>
            ))}
          </div>
        ))}
      </aside>
      <section className="admin-content">
        <Outlet />
      </section>
    </div>
  );
}
