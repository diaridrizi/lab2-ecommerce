import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatDate, money } from '../../api.js';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/admin/stats').then(setStats).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="alert alert-error">{error}</p>;
  if (!stats) return <p className="muted">Loading…</p>;

  const tiles = [
    { label: 'Revenue', value: money(stats.revenue) },
    { label: 'Orders', value: stats.orders },
    { label: 'Products', value: stats.products },
    { label: 'Customers', value: stats.customers },
  ];

  return (
    <>
      <h1>Dashboard</h1>
      <div className="tiles">
        {tiles.map((t) => (
          <div key={t.label} className="card tile">
            <span className="muted">{t.label}</span>
            <strong>{t.value}</strong>
          </div>
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
