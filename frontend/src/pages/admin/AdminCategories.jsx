import { useEffect, useState } from 'react';
import { api } from '../../api.js';

export default function AdminCategories() {
  const [categories, setCategories] = useState([]);
  const [name, setName] = useState('');
  const [editing, setEditing] = useState(null); // { id, name }
  const [error, setError] = useState('');

  const load = () => api.get('/categories').then(setCategories).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const run = async (fn) => {
    setError('');
    try {
      await fn();
      load();
      window.dispatchEvent(new Event('categories-changed')); // tell the header/footer menus to reload
    } catch (e) {
      setError(e.message);
    }
  };

  const onCreate = (e) => {
    e.preventDefault();
    run(async () => {
      await api.post('/admin/categories', { name });
      setName('');
    });
  };

  const onSave = () =>
    run(async () => {
      await api.put(`/admin/categories/${editing.id}`, { name: editing.name });
      setEditing(null);
    });

  const onDelete = (c) => {
    if (!window.confirm(`Delete "${c.name}"? Its products will have no category.`)) return;
    run(() => api.del(`/admin/categories/${c.id}`));
  };

  return (
    <>
      <h1>Categories</h1>
      {error && <p className="alert alert-error">{error}</p>}
      <form className="card inline-form" onSubmit={onCreate}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New category name" required />
        <button className="btn btn-primary">Add</button>
      </form>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>ID</th><th>Name</th><th>Slug</th><th>Products</th><th></th></tr></thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id}>
                <td>{c.id}</td>
                <td>
                  {editing?.id === c.id ? (
                    <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} autoFocus />
                  ) : c.name}
                </td>
                <td><code>{c.slug}</code></td>
                <td>{c.product_count}</td>
                <td className="row-actions">
                  {editing?.id === c.id ? (
                    <>
                      <button className="btn btn-sm btn-primary" onClick={onSave}>Save</button>
                      <button className="btn btn-sm" onClick={() => setEditing(null)}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <button className="btn btn-sm" onClick={() => setEditing({ id: c.id, name: c.name })}>Rename</button>
                      <button className="btn btn-sm btn-danger" onClick={() => onDelete(c)}>Delete</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
