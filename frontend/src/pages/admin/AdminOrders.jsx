import { useEffect, useState } from 'react';
import { api, formatDate, money } from '../../api.js';
import StatusBadge from '../../components/StatusBadge.jsx';
import { PaymentMethod, PaymentStatus } from '../../components/PaymentInfo.jsx';
import { useRealtime } from '../../context/NotificationContext.jsx';

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [statuses, setStatuses] = useState([]); // from the backend, for the filter
  const [filter, setFilter] = useState('');
  const [payment, setPayment] = useState(''); // '' | 'cash' | 'card'
  const [selected, setSelected] = useState(null); // full order with items
  const [error, setError] = useState('');

  const load = () => {
    const q = new URLSearchParams();
    if (filter) q.set('status', filter);
    if (payment) q.set('payment', payment);
    return api.get(`/admin/orders?${q}`).then(setOrders).catch((e) => setError(e.message));
  };

  useEffect(() => { load(); }, [filter, payment]);

  // Live: new orders, payments and changes by other admins or customers show up without reloading
  const [flash, setFlash] = useState(null); // id of the row that just changed (highlighted)
  const onLive = (o) => {
    load();
    setFlash(o.id);
    setTimeout(() => setFlash((f) => (f === o.id ? null : f)), 2500);
    if (selected?.id === o.id) api.get(`/admin/orders/${o.id}`).then(setSelected).catch(() => setSelected(null));
  };
  useRealtime('order:created', onLive);
  useRealtime('order:updated', onLive);
  useRealtime('order:deleted', onLive);
  useEffect(() => {
    api.get('/admin/order-flows').then((d) => setStatuses(d.statuses)).catch((e) => setError(e.message));
  }, []);

  const openOrder = async (id) => {
    try {
      setSelected(await api.get(`/admin/orders/${id}`));
    } catch (e) {
      setError(e.message);
    }
  };

  const changeStatus = async (order, status) => {
    const refund = order.payment_status === 'paid' && order.payment_method === 'card' ? ' The card payment will be refunded.' : '';
    if (status === 'cancelled' && !window.confirm(`Cancel this order? Stock will be returned.${refund}`)) return;
    setError('');
    try {
      const updated = await api.patch(`/admin/orders/${order.id}/status`, { status });
      if (selected?.id === order.id) setSelected(updated);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const deleteOrder = async (order) => {
    const open = !['cancelled', 'delivered'].includes(order.status);
    const note = open ? ' The items will be put back in stock.' : '';
    if (!window.confirm(`Delete order #${order.id} permanently?${note}`)) return;
    setError('');
    try {
      await api.del(`/admin/orders/${order.id}`);
      if (selected?.id === order.id) setSelected(null);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <>
      <div className="page-head">
        <h1>Orders</h1>
        <div className="toolbar-selects">
          <select value={payment} onChange={(e) => setPayment(e.target.value)} aria-label="Payment method">
            <option value="">All payments</option>
            <option value="card">Card</option>
            <option value="cash">Cash on delivery</option>
          </select>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Status">
            <option value="">All statuses</option>
            {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      {error && <p className="alert alert-error">{error}</p>}

      <div className="card table-wrap">
        <table>
          <thead>
            <tr><th>#</th><th>Customer</th><th>Date</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th><th>Change</th><th></th></tr>
          </thead>
          <tbody>
            {orders.length === 0 && <tr><td colSpan="9" className="muted">No orders.</td></tr>}
            {orders.map((o) => (
              <tr key={o.id} className={`${selected?.id === o.id ? 'selected' : ''} ${flash === o.id ? 'row-flash' : ''}`}>
                <td><button className="link" onClick={() => openOrder(o.id)}>#{o.id}</button></td>
                <td>{o.customer_name}<div className="muted small">{o.customer_email}</div></td>
                <td>{formatDate(o.created_at)}</td>
                <td>{o.item_count}</td>
                <td>{money(o.total)}{Number(o.shipping_cost) > 0 && <div className="muted small">{o.shipping_method_name}</div>}</td>
                <td><PaymentMethod order={o} /><div><PaymentStatus status={o.payment_status} /></div></td>
                <td><StatusBadge status={o.status} /></td>
                <td>
                  {/* This order's own step order (card: paid before shipped, cash: shipped before paid); earlier steps are disabled */}
                  <select value={o.status} disabled={o.status === 'cancelled'} onChange={(e) => changeStatus(o, e.target.value)}>
                    {o.steps.map((s, i) => (
                      <option key={s} value={s} disabled={o.status !== 'cancelled' && i < o.steps.indexOf(o.status)}>
                        {i + 1}. {s}
                      </option>
                    ))}
                    <option value="cancelled">cancelled</option>
                  </select>
                </td>
                <td><button className="btn btn-sm btn-danger" onClick={() => deleteOrder(o)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="card order-panel">
          <div className="page-head">
            <h3>Order #{selected.id} · {selected.customer_name}</h3>
            <button className="btn btn-sm" onClick={() => setSelected(null)}>Close</button>
          </div>
          <div className="order-panel-grid">
            <div>
              <h4>Ship to</h4>
              <p>
                {selected.shipping_name}<br />
                {selected.shipping_address}<br />
                {[selected.shipping_postal_code, selected.shipping_city].filter(Boolean).join(' ')}<br />
                {selected.shipping_country}
              </p>
            </div>
            <div>
              <h4>Contact</h4>
              <p>{selected.shipping_email || selected.customer_email}<br />{selected.shipping_phone}</p>
            </div>
            <div>
              <h4>Payment</h4>
              <p><PaymentMethod order={selected} /><br /><PaymentStatus status={selected.payment_status} /></p>
            </div>
            <div>
              <h4>Delivery</h4>
              <p>
                {selected.shipping_method_name || selected.shipping_method}<br />
                {Number(selected.shipping_cost) ? money(selected.shipping_cost) : 'Free'}
              </p>
            </div>
          </div>
          {selected.notes && <p className="order-notes"><strong>Notes:</strong> {selected.notes}</p>}
          <table>
            <thead><tr><th>Product</th><th>Size</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
            <tbody>
              {selected.items.map((i) => (
                <tr key={i.id}>
                  <td>{i.product_name}</td>
                  <td>{i.size || '—'}</td>
                  <td>{i.quantity}</td>
                  <td>{money(i.unit_price)}</td>
                  <td>{money(i.unit_price * i.quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="order-panel-total"><strong>Total: {money(selected.total)}</strong></p>
        </div>
      )}
    </>
  );
}
