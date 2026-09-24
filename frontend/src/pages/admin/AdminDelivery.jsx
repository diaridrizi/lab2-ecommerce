import { useEffect, useState } from 'react';
import { api, money } from '../../api.js';

// Delivery methods CRUD (PostgreSQL) — these are the options customers see at checkout
const EMPTY_FORM = { name: '', code: '', description: '', price: '0', sort_order: '0', is_active: true };

export default function AdminDelivery() {
  const [methods, setMethods] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');

  const load = () => api.get('/admin/shipping-methods').then(setMethods).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const openNew = () => {
    setForm({ ...EMPTY_FORM, sort_order: String(methods.length) });
    setEditingId(null);
    setShowForm(true);
  };
  const openEdit = (m) => {
    setForm({ name: m.name, code: m.code, description: m.description, price: String(m.price), sort_order: String(m.sort_order), is_active: m.is_active });
    setEditingId(m.id);
    setShowForm(true);
  };
  const onChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm({ ...form, [name]: type === 'checkbox' ? checked : value });
  };

  const save = async (id, body) => {
    setError('');
    try {
      if (id) await api.put(`/admin/shipping-methods/${id}`, body);
      else await api.post('/admin/shipping-methods', body);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      load();
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const body = { ...form, price: Number(form.price), sort_order: Number(form.sort_order) };
    if (await save(editingId, body)) setShowForm(false);
  };

  const toggleActive = (m) => save(m.id, { ...m, is_active: !m.is_active });

  const onDelete = async (m) => {
    if (!window.confirm(`Delete "${m.name}"? Past orders keep their delivery name and price.`)) return;
    setError('');
    try {
      await api.del(`/admin/shipping-methods/${m.id}`);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <>
      <div className="page-head">
        <h1>Delivery</h1>
        <button className="btn btn-primary" onClick={openNew}>+ New method</button>
      </div>
      <p className="muted">These are the delivery options customers can choose at checkout. Hidden methods are not shown.</p>
      {error && <p className="alert alert-error">{error}</p>}

      {showForm && (
        <form className="card form form-grid" onSubmit={onSubmit}>
          <h3 className="span-2">{editingId ? `Edit “${form.name}”` : 'New delivery method'}</h3>
          <label>Name<input name="name" value={form.name} onChange={onChange} placeholder="e.g. Express delivery" required /></label>
          <label>
            Code <span className="muted small">— saved on orders; empty = made from the name</span>
            <input name="code" value={form.code} onChange={onChange} placeholder="e.g. express" />
          </label>
          <label className="span-2">Description<input name="description" value={form.description} onChange={onChange} placeholder="e.g. 1–2 working days" /></label>
          <label>Price (€) <span className="muted small">— 0 = free</span><input type="number" step="0.01" min="0" name="price" value={form.price} onChange={onChange} required /></label>
          <label>Position <span className="muted small">— lower comes first</span><input type="number" step="1" name="sort_order" value={form.sort_order} onChange={onChange} /></label>
          <label className="checkbox"><input type="checkbox" name="is_active" checked={form.is_active} onChange={onChange} /> Show at checkout</label>
          <div className="span-2 actions">
            <button type="button" className="btn" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="btn btn-primary">{editingId ? 'Save changes' : 'Create method'}</button>
          </div>
        </form>
      )}

      <div className="card table-wrap">
        <table>
          <thead><tr><th>Position</th><th>Name</th><th>Code</th><th>Description</th><th>Price</th><th>Used in orders</th><th>Visible</th><th></th></tr></thead>
          <tbody>
            {methods.length === 0 && <tr><td colSpan="8" className="muted">No delivery methods yet — customers can't check out until you add one.</td></tr>}
            {methods.map((m) => (
              <tr key={m.id} className={m.is_active ? '' : 'inactive'}>
                <td>{m.sort_order}</td>
                <td><strong>{m.name}</strong></td>
                <td><code>{m.code}</code></td>
                <td>{m.description || '—'}</td>
                <td>{Number(m.price) ? money(m.price) : 'Free'}</td>
                <td>{m.order_count}</td>
                <td><button className="btn btn-sm" onClick={() => toggleActive(m)}>{m.is_active ? 'Visible' : 'Hidden'}</button></td>
                <td className="row-actions">
                  <button className="btn btn-sm" onClick={() => openEdit(m)}>Edit</button>
                  <button className="btn btn-sm btn-danger" onClick={() => onDelete(m)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
