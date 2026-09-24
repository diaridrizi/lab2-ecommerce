import { useEffect, useState } from 'react';
import { api, formatDate } from '../../api.js';

// Newsletter subscribers CRUD (MongoDB). People subscribe via the footer form; the admin can also add them here.
const EMPTY_FORM = { email: '', name: '', status: 'subscribed' };

export default function AdminSubscribers() {
  const [subscribers, setSubscribers] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    const q = new URLSearchParams();
    if (search) q.set('search', search);
    if (status) q.set('status', status);
    return api.get(`/admin/subscribers?${q}`).then(setSubscribers).catch((e) => setError(e.message));
  };
  useEffect(() => { load(); }, [status]);

  const openNew = () => { setForm(EMPTY_FORM); setEditingId(null); setShowForm(true); };
  const openEdit = (s) => { setForm({ email: s.email, name: s.name, status: s.status }); setEditingId(s._id); setShowForm(true); };
  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const run = async (fn) => {
    setError('');
    try {
      await fn();
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
    const ok = await run(() => (editingId ? api.put(`/admin/subscribers/${editingId}`, form) : api.post('/admin/subscribers', form)));
    if (ok) setShowForm(false);
  };

  const toggle = (s) => run(() => api.put(`/admin/subscribers/${s._id}`, { status: s.status === 'subscribed' ? 'unsubscribed' : 'subscribed' }));
  const onDelete = (s) => {
    if (!window.confirm(`Delete ${s.email}?`)) return;
    run(() => api.del(`/admin/subscribers/${s._id}`));
  };

  const activeCount = subscribers.filter((s) => s.status === 'subscribed').length;

  return (
    <>
      <div className="page-head">
        <h1>Subscribers</h1>
        <button className="btn btn-primary" onClick={openNew}>+ Add subscriber</button>
      </div>
      <p className="muted">Newsletter sign-ups from the footer. {activeCount} of {subscribers.length} shown are subscribed.</p>
      {error && <p className="alert alert-error">{error}</p>}

      {showForm && (
        <form className="card form form-grid" onSubmit={onSubmit}>
          <h3 className="span-2">{editingId ? 'Edit subscriber' : 'Add subscriber'}</h3>
          <label>Email<input type="email" name="email" value={form.email} onChange={onChange} required /></label>
          <label>Name <span className="muted small">(optional)</span><input name="name" value={form.name} onChange={onChange} /></label>
          <label>
            Status
            <select name="status" value={form.status} onChange={onChange}>
              <option value="subscribed">Subscribed</option>
              <option value="unsubscribed">Unsubscribed</option>
            </select>
          </label>
          <div className="span-2 actions">
            <button type="button" className="btn" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="btn btn-primary">{editingId ? 'Save changes' : 'Add subscriber'}</button>
          </div>
        </form>
      )}

      <form className="admin-filters" onSubmit={(e) => { e.preventDefault(); load(); }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search email or name…" aria-label="Search subscribers" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="">All</option>
          <option value="subscribed">Subscribed</option>
          <option value="unsubscribed">Unsubscribed</option>
        </select>
        <button className="btn">Search</button>
      </form>

      <div className="card table-wrap">
        <table>
          <thead><tr><th>Email</th><th>Name</th><th>Status</th><th>Source</th><th>Signed up</th><th></th></tr></thead>
          <tbody>
            {subscribers.length === 0 && <tr><td colSpan="6" className="muted">No subscribers found.</td></tr>}
            {subscribers.map((s) => (
              <tr key={s._id} className={s.status === 'subscribed' ? '' : 'inactive'}>
                <td>{s.email}</td>
                <td>{s.name || '—'}</td>
                <td>
                  <button className={`status ${s.status === 'subscribed' ? 'pay-paid' : 'pay-refunded'} status-toggle`} onClick={() => toggle(s)} title="Click to change">
                    {s.status}
                  </button>
                </td>
                <td>{s.source}</td>
                <td>{formatDate(s.createdAt)}</td>
                <td className="row-actions">
                  <button className="btn btn-sm" onClick={() => openEdit(s)}>Edit</button>
                  <button className="btn btn-sm btn-danger" onClick={() => onDelete(s)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
