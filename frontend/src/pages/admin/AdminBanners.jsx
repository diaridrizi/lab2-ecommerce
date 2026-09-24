import { useEffect, useState } from 'react';
import { api } from '../../api.js';

// Homepage banners CRUD (MongoDB)
const EMPTY_FORM = { title: '', eyebrow: '', text: '', image: '', ctaLabel: 'Shop now', ctaLink: '/shop', isActive: true };

export default function AdminBanners() {
  const [banners, setBanners] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');

  const load = () => api.get('/admin/banners').then(setBanners).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const openNew = () => { setForm(EMPTY_FORM); setEditingId(null); setShowForm(true); };
  const openEdit = (b) => {
    setForm({ title: b.title, eyebrow: b.eyebrow, text: b.text, image: b.image, ctaLabel: b.ctaLabel, ctaLink: b.ctaLink, isActive: b.isActive });
    setEditingId(b._id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const onChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm({ ...form, [name]: type === 'checkbox' ? checked : value });
  };

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
    const ok = await run(() => (editingId ? api.put(`/admin/banners/${editingId}`, form) : api.post('/admin/banners', form)));
    if (ok) setShowForm(false);
  };

  // Move a banner up/down: build the new order, then save each banner's position (0, 1, 2, …)
  const move = (index, dir) => {
    const next = [...banners];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setBanners(next); // show the new order right away
    run(() => Promise.all(next.map((b, i) => (b.sortOrder === i ? null : api.put(`/admin/banners/${b._id}`, { sortOrder: i })))));
  };

  const onDelete = (b) => {
    if (!window.confirm(`Delete banner "${b.title}"?`)) return;
    run(() => api.del(`/admin/banners/${b._id}`));
  };

  return (
    <>
      <div className="page-head">
        <h1>Banners</h1>
        <button className="btn btn-primary" onClick={openNew}>+ New banner</button>
      </div>
      <p className="muted">The slideshow at the top of the homepage. Only visible banners are shown, in this order.</p>
      {error && <p className="alert alert-error">{error}</p>}

      {showForm && (
        <form className="card form form-grid banner-form" onSubmit={onSubmit}>
          <h3 className="span-2">{editingId ? 'Edit banner' : 'New banner'}</h3>
          <label>Title<input name="title" value={form.title} onChange={onChange} maxLength="80" required /></label>
          <label>Small label above the title<input name="eyebrow" value={form.eyebrow} onChange={onChange} placeholder="e.g. Just dropped" maxLength="40" /></label>
          <label className="span-2">Text<input name="text" value={form.text} onChange={onChange} maxLength="200" /></label>
          <label className="span-2">
            Image URL <span className="muted small">— e.g. /images/banners/store.jpg or https://…</span>
            <input name="image" value={form.image} onChange={onChange} required />
          </label>
          <label>Button text<input name="ctaLabel" value={form.ctaLabel} onChange={onChange} maxLength="40" /></label>
          <label>Button link<input name="ctaLink" value={form.ctaLink} onChange={onChange} placeholder="/shop?sale=1" /></label>
          <label className="checkbox"><input type="checkbox" name="isActive" checked={form.isActive} onChange={onChange} /> Visible on the homepage</label>
          {form.image && (
            <div className="span-2 banner-preview">
              <img src={form.image} alt="" />
              <div>
                {form.eyebrow && <span className="slide-eyebrow">{form.eyebrow}</span>}
                <strong>{form.title || 'Title'}</strong>
                <p>{form.text}</p>
              </div>
            </div>
          )}
          <div className="span-2 actions">
            <button type="button" className="btn" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="btn btn-primary">{editingId ? 'Save changes' : 'Create banner'}</button>
          </div>
        </form>
      )}

      <div className="banner-list">
        {banners.length === 0 && <p className="muted">No banners yet — the homepage slideshow is hidden.</p>}
        {banners.map((b, i) => (
          <div key={b._id} className={`card banner-row ${b.isActive ? '' : 'inactive'}`}>
            <img src={b.image} alt="" />
            <div className="grow">
              {b.eyebrow && <span className="product-brand">{b.eyebrow}</span>}
              <h3>{b.title}</h3>
              <p className="muted small">{b.text}</p>
              <p className="small">Button: <strong>{b.ctaLabel}</strong> → <code>{b.ctaLink}</code></p>
            </div>
            <div className="banner-actions">
              <div className="row-actions">
                <button className="btn btn-sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">↑</button>
                <button className="btn btn-sm" onClick={() => move(i, 1)} disabled={i === banners.length - 1} aria-label="Move down">↓</button>
              </div>
              <button className="btn btn-sm" onClick={() => run(() => api.put(`/admin/banners/${b._id}`, { isActive: !b.isActive }))}>
                {b.isActive ? 'Visible' : 'Hidden'}
              </button>
              <div className="row-actions">
                <button className="btn btn-sm" onClick={() => openEdit(b)}>Edit</button>
                <button className="btn btn-sm btn-danger" onClick={() => onDelete(b)}>Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
