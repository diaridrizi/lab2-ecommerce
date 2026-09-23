import { useEffect, useState } from 'react';
import { api, money } from '../../api.js';

const EMPTY_FORM = { name: '', description: '', price: '', stock: '', image_url: '', category_id: '', is_active: true };

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null); // null = creating a new product
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');

  const load = () => api.get('/admin/products').then(setProducts).catch((e) => setError(e.message));

  useEffect(() => {
    load();
    api.get('/categories').then(setCategories);
  }, []);

  const openNew = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (p) => {
    setForm({
      name: p.name, description: p.description, price: p.price, stock: p.stock,
      image_url: p.image_url || '', category_id: p.category_id || '', is_active: p.is_active,
    });
    setEditingId(p.id);
    setShowForm(true);
  };

  const onChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm({ ...form, [name]: type === 'checkbox' ? checked : value });
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const body = { ...form, price: Number(form.price), stock: Number(form.stock || 0) };
    try {
      if (editingId) await api.put(`/admin/products/${editingId}`, body);
      else await api.post('/admin/products', body);
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const onDelete = async (p) => {
    if (!window.confirm(`Delete "${p.name}"?`)) return;
    try {
      await api.del(`/admin/products/${p.id}`);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <>
      <div className="page-head">
        <h1>Products</h1>
        <button className="btn btn-primary" onClick={openNew}>+ New product</button>
      </div>
      {error && <p className="alert alert-error">{error}</p>}

      {showForm && (
        <form className="card form form-grid" onSubmit={onSubmit}>
          <h3 className="span-2">{editingId ? `Edit product #${editingId}` : 'New product'}</h3>
          <label>Name<input name="name" value={form.name} onChange={onChange} required /></label>
          <label>
            Category
            <select name="category_id" value={form.category_id} onChange={onChange}>
              <option value="">— none —</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label>Price (€)<input type="number" step="0.01" min="0" name="price" value={form.price} onChange={onChange} required /></label>
          <label>Stock<input type="number" min="0" step="1" name="stock" value={form.stock} onChange={onChange} required /></label>
          <label className="span-2">Image URL<input name="image_url" value={form.image_url} onChange={onChange} placeholder="https://…" /></label>
          <label className="span-2">Description<textarea name="description" rows="3" value={form.description} onChange={onChange} /></label>
          <label className="checkbox"><input type="checkbox" name="is_active" checked={form.is_active} onChange={onChange} /> Visible in shop</label>
          <div className="span-2 actions">
            <button type="button" className="btn" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="btn btn-primary">{editingId ? 'Save changes' : 'Create product'}</button>
          </div>
        </form>
      )}

      <div className="card table-wrap">
        <table>
          <thead>
            <tr><th>ID</th><th>Name</th><th>Category</th><th>Price</th><th>Stock</th><th>Visible</th><th></th></tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className={p.is_active ? '' : 'inactive'}>
                <td>{p.id}</td>
                <td>{p.name}</td>
                <td>{p.category_name || '—'}</td>
                <td>{money(p.price)}</td>
                <td className={p.stock <= 5 ? 'warn' : ''}>{p.stock}</td>
                <td>{p.is_active ? 'Yes' : 'No'}</td>
                <td className="row-actions">
                  <button className="btn btn-sm" onClick={() => openEdit(p)}>Edit</button>
                  <button className="btn btn-sm btn-danger" onClick={() => onDelete(p)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
