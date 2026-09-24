import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatDate, money } from '../../api.js';
import { useRealtime } from '../../context/NotificationContext.jsx';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  const load = () => api.get('/admin/stats').then(setStats).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);
  // Live: numbers update when orders come in or change
  useRealtime('order:created', load);
  useRealtime('order:updated', load);
  useRealtime('order:deleted', load);

  if (error) return <p className="alert alert-error">{error}</p>;
  if (!stats) return <p className="muted">Loading…</p>;

  const tiles = [
    { label: 'Revenue', value: money(stats.revenue), to: '/admin/orders' },
    { label: 'Orders', value: stats.orders, to: '/admin/orders' },
    { label: 'Products', value: stats.products, to: '/admin/products' },
    { label: 'Customers', value: stats.customers, to: '/admin/users' },
    { label: 'Reviews', value: stats.reviews, to: '/admin/reviews', mongo: true },
    { label: 'Subscribers', value: stats.subscribers, to: '/admin/subscribers', mongo: true },
    { label: 'Active banners', value: stats.activeBanners, to: '/admin/banners', mongo: true },
    { label: 'Online now', value: stats.onlineUsers, to: '/admin/users', live: true },
  ];

  return (
    <>
      <h1>Dashboard</h1>
      <div className="tiles stagger">
        {tiles.map((t, i) => (
          <Link key={t.label} to={t.to} className={`card tile ${t.mongo ? 'tile-mongo' : ''}`} style={{ '--i': i }}>
            <span className="muted">
              {t.label}{' '}
              {t.live ? <span className="live-dot on">WebSocket</span> : <span className={`db-tag ${t.mongo ? 'mongo' : ''}`}>{t.mongo ? 'Mongo' : 'PG'}</span>}
            </span>
            <strong>{t.value}</strong>
          </Link>
        ))}
      </div>

      <div className="two-col">
        <div className="card">
          <h3>Orders by status <span className="db-tag">PostgreSQL</span></h3>
          {stats.ordersByStatus.length === 0 ? <p className="muted">No orders yet.</p> : (
            <ul className="plain-list">
              {stats.ordersByStatus.map((s) => (
                <li key={s.status}><span className={`status status-${s.status}`}>{s.status}</span> {s.count}</li>
              ))}
            </ul>
          )}
          <h3>Payments <span className="db-tag">PostgreSQL</span></h3>
          {stats.ordersByPayment.length === 0 ? <p className="muted">No orders yet.</p> : (
            <ul className="plain-list">
              {stats.ordersByPayment.map((p) => (
                <li key={p.payment_method}>
                  <strong>{p.payment_method === 'card' ? 'Card' : 'Cash on delivery'}</strong> — {p.count} orders · {money(p.total)}
                </li>
              ))}
            </ul>
          )}
          <h3>Low stock</h3>
          {stats.lowStock.length === 0 ? <p className="muted">All good.</p> : (
            <ul className="plain-list">
              {stats.lowStock.map((p) => (
                <li key={p.id}>{p.name} — <strong>{p.stock}</strong> left</li>
              ))}
            </ul>
          )}
          <Link to="/admin/products">Manage products →</Link>
        </div>

        <div className="card">
          <h3>Activity by type <span className="db-tag mongo">MongoDB</span></h3>
          <ul className="plain-list">
            {stats.topActions.map((a) => (
              <li key={a.action}><code>{a.action}</code> {a.count}</li>
            ))}
          </ul>
          <h3>Recent activity</h3>
          <ul className="plain-list activity">
            {stats.recentActivity.map((a) => (
              <li key={a._id}>
                <code>{a.action}</code>
                <span className="muted small">
                  {a.userId ? `user #${a.userId} · ` : ''}{formatDate(a.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
