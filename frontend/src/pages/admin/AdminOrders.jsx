import { useEffect, useState } from 'react';
import { api, formatDate, money } from '../../api.js';
import StatusBadge from '../../components/StatusBadge.jsx';

const STATUSES = ['pending', 'paid', 'shipped', 'delivered', 'cancelled'];

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState(null); // full order with items
  const [error, setError] = useState('');

  const load = () =>
    api.get(`/admin/orders${filter ? `?status=${filter}` : ''}`).then(setOrders).catch((e) => setError(e.message));

  useEffect(() => { load(); }, [filter]);

  const openOrder = async (id) => {
    try {
      setSelected(await api.get(`/admin/orders/${id}`));
    } catch (e) {
      setError(e.message);
    }
  };

  const changeStatus = async (id, status) => {
    if (status === 'cancelled' && !window.confirm('Cancel this order? Stock will be returned.')) return;
    setError('');
    try {
      const updated = await api.patch(`/admin/orders/${id}/status`, { status });
      if (selected?.id === id) setSelected(updated);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <>
      <div className="page-head">
        <h1>Orders</h1>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      {error && <p className="alert alert-error">{error}</p>}

      <div className="card table-wrap">
        <table>
          <thead>
            <tr><th>#</th><th>Customer</th><th>Date</th><th>Items</th><th>Total</th><th>Status</th><th>Change</th></tr>
          </thead>
          <tbody>
            {orders.length === 0 && <tr><td colSpan="7" className="muted">No orders.</td></tr>}
            {orders.map((o) => (
              <tr key={o.id}>
                <td><button className="link" onClick={() => openOrder(o.id)}>#{o.id}</button></td>
                <td>{o.customer_name}<div className="muted small">{o.customer_email}</div></td>
                <td>{formatDate(o.created_at)}</td>
                <td>{o.item_count}</td>
                <td>{money(o.total)}</td>
                <td><StatusBadge status={o.status} /></td>
                <td>
                  <select
                    value={o.status}
                    disabled={o.status === 'cancelled'}
                    onChange={(e) => changeStatus(o.id, e.target.value)}
                  >
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="card">
          <div className="page-head">
            <h3>Order #{selected.id} · {selected.customer_name}</h3>
            <button className="btn btn-sm" onClick={() => setSelected(null)}>Close</button>
          </div>
          <p className="muted">
            Ship to: {selected.shipping_name}, {selected.shipping_address}, {selected.shipping_city} · {selected.shipping_phone}
          </p>
          <ul className="plain-list">
            {selected.items.map((i) => (
              <li key={i.id}>{i.quantity} × {i.product_name} — {money(i.unit_price * i.quantity)}</li>
            ))}
          </ul>
          <strong>Total: {money(selected.total)}</strong>
        </div>
      )}
    </>
  );
}
