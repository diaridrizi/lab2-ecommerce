import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatDate, money } from '../api.js';
import StatusBadge from '../components/StatusBadge.jsx';

export default function Orders() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/orders').then(setOrders).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="alert alert-error">{error}</p>;
  if (!orders) return <p className="muted">Loading…</p>;

  return (
    <>
      <h1>My orders</h1>
      {orders.length === 0 ? (
        <p className="empty">You haven't placed any orders yet. <Link to="/">Go shopping →</Link></p>
      ) : (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr><th>Order</th><th>Date</th><th>Items</th><th>Total</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>#{o.id}</td>
                  <td>{formatDate(o.created_at)}</td>
                  <td>{o.item_count}</td>
                  <td>{money(o.total)}</td>
                  <td><StatusBadge status={o.status} /></td>
                  <td><Link to={`/orders/${o.id}`}>View</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
