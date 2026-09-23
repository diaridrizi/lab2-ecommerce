import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { api, formatDate, money } from '../api.js';
import StatusBadge from '../components/StatusBadge.jsx';

export default function OrderDetail() {
  const { id } = useParams();
  const location = useLocation();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/orders/${id}`).then(setOrder).catch((e) => setError(e.message));
  }, [id]);

  const cancel = async () => {
    if (!window.confirm('Cancel this order?')) return;
    try {
      setOrder(await api.post(`/orders/${id}/cancel`));
    } catch (e) {
      setError(e.message);
    }
  };

  if (error) return <p className="alert alert-error">{error}</p>;
  if (!order) return <p className="muted">Loading…</p>;

  return (
    <>
      <Link to="/orders" className="back">← All orders</Link>
      {location.state?.justPlaced && (
        <p className="alert alert-success">Thank you! Your order has been placed.</p>
      )}
      <div className="page-head">
        <h1>Order #{order.id}</h1>
        <StatusBadge status={order.status} />
      </div>
      <p className="muted">Placed {formatDate(order.created_at)}</p>

      <div className="cart-layout">
        <div className="card table-wrap">
          <table>
            <thead><tr><th>Product</th><th>Price</th><th>Qty</th><th>Total</th></tr></thead>
            <tbody>
              {order.items.map((i) => (
                <tr key={i.id}>
                  <td>{i.slug ? <Link to={`/products/${i.slug}`}>{i.product_name}</Link> : i.product_name}</td>
                  <td>{money(i.unit_price)}</td>
                  <td>{i.quantity}</td>
                  <td>{money(i.unit_price * i.quantity)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><td colSpan="3"><strong>Total</strong></td><td><strong>{money(order.total)}</strong></td></tr></tfoot>
          </table>
        </div>
        <aside className="card summary">
          <h3>Shipping to</h3>
          <p>
            {order.shipping_name}<br />
            {order.shipping_address}<br />
            {order.shipping_city}<br />
            {order.shipping_phone}
          </p>
          {order.status === 'pending' && (
            <button className="btn btn-danger btn-block" onClick={cancel}>Cancel order</button>
          )}
        </aside>
      </div>
    </>
  );
}
