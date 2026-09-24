import { useEffect, useState } from 'react';
import { api, money } from '../../api.js';

const EMPTY_FORM = {
  name: '', brand: '', description: '', price: '', compare_at_price: '', stock: '', image_url: '', category_id: '', is_active: true,
  sizes: [], // [{ size, stock }] — empty = one size
};

// Quick-fill buttons for the size editor
const SIZE_PRESETS = {
  'Sneakers (EU 38–46)': ['38', '39', '40', '40.5', '41', '42', '42.5', '43', '44', '45', '46'],
  'Clothing (XS–XXL)': ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
};

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
      name: p.name, brand: p.brand || '', description: p.description, price: p.price,
      compare_at_price: p.compare_at_price ?? '', stock: p.stock,
      image_url: p.image_url || '', category_id: p.category_id || '', is_active: p.is_active,
      sizes: p.sizes.map((s) => ({ size: s.size, stock: s.stock })),
    });
    setEditingId(p.id);
    setShowForm(true);
  };

  const onChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm({ ...form, [name]: type === 'checkbox' ? checked : value });
  };

  // ---- size editor ----
  const setSizes = (sizes) => setForm((f) => ({ ...f, sizes }));
  const updateSize = (i, field, value) => setSizes(form.sizes.map((s, j) => (j === i ? { ...s, [field]: value } : s)));
  const applyPreset = (list) => setSizes(list.map((size) => form.sizes.find((s) => s.size === size) || { size, stock: 0 }));
  const hasSizes = form.sizes.length > 0;
  const sizeTotal = form.sizes.reduce((sum, s) => sum + (Number(s.stock) || 0), 0);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const body = {
      ...form,
      price: Number(form.price),
      compare_at_price: form.compare_at_price === '' ? null : Number(form.compare_at_price),
      stock: hasSizes ? sizeTotal : Number(form.stock || 0),
      sizes: form.sizes.map((s) => ({ size: s.size.trim(), stock: Number(s.stock) || 0 })),
    };
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
          <label>Brand<input name="brand" value={form.brand} onChange={onChange} placeholder="e.g. Nike" /></label>
          <label className="span-2">
            Category
            <select name="category_id" value={form.category_id} onChange={onChange}>
              <option value="">— none —</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label>Price (€)<input type="number" step="0.01" min="0" name="price" value={form.price} onChange={onChange} required /></label>
          <label>
            Old price (€) <span className="muted small">— fill in to put the product on sale</span>
            <input type="number" step="0.01" min="0" name="compare_at_price" value={form.compare_at_price} onChange={onChange} placeholder="empty = not on sale" />
          </label>
          <label>
            Stock {hasSizes && <span className="muted small">— total of all sizes</span>}
            <input type="number" min="0" step="1" name="stock" value={hasSizes ? sizeTotal : form.stock} onChange={onChange} disabled={hasSizes} required={!hasSizes} />
          </label>

          <div className="span-2 size-editor">
            <div className="size-editor-head">
              <strong>Sizes</strong>
              <span className="muted small">{hasSizes ? `${form.sizes.length} sizes` : 'One size (no size choice)'}</span>
              <span className="grow" />
              {Object.entries(SIZE_PRESETS).map(([label, list]) => (
                <button key={label} type="button" className="btn btn-sm" onClick={() => applyPreset(list)}>{label}</button>
              ))}
              {hasSizes && <button type="button" className="btn btn-sm btn-danger" onClick={() => setSizes([])}>One size</button>}
            </div>
            {hasSizes && (
              <div className="size-editor-grid">
                {form.sizes.map((s, i) => (
                  <div key={i} className="size-editor-row">
                    <input value={s.size} onChange={(e) => updateSize(i, 'size', e.target.value)} aria-label="Size" placeholder="Size" required />
                    <input type="number" min="0" step="1" value={s.stock} onChange={(e) => updateSize(i, 'stock', e.target.value)} aria-label={`Stock for ${s.size}`} />
                    <button type="button" className="icon-btn" onClick={() => setSizes(form.sizes.filter((_, j) => j !== i))} aria-label={`Remove size ${s.size}`}>✕</button>
                  </div>
                ))}
              </div>
            )}
            <button type="button" className="btn btn-sm" onClick={() => setSizes([...form.sizes, { size: '', stock: 0 }])}>+ Add size</button>
          </div>
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
            <tr><th>ID</th><th>Name</th><th>Brand</th><th>Category</th><th>Price</th><th>Stock</th><th>Visible</th><th></th></tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className={p.is_active ? '' : 'inactive'}>
                <td>{p.id}</td>
                <td>{p.name}</td>
                <td>{p.brand || '—'}</td>
                <td>{p.category_name || '—'}</td>
                <td>
                  {money(p.price)}
                  {p.compare_at_price > p.price && <s className="muted small"> {money(p.compare_at_price)}</s>}
                </td>
                <td className={p.stock <= 5 ? 'warn' : ''}>
                  {p.stock}
                  {p.sizes.length > 0 && <div className="muted small">{p.sizes.filter((s) => s.stock > 0).length}/{p.sizes.length} sizes</div>}
                </td>
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
