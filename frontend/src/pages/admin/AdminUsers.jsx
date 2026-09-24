import { useEffect, useState } from 'react';
import { api, formatDate, money } from '../../api.js';
import { useAuth } from '../../context/AuthContext.jsx';

// Users CRUD (PostgreSQL)
const EMPTY_FORM = { name: '', email: '', password: '', role: 'customer' };

export default function AdminUsers() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null); // null = creating
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    const q = new URLSearchParams();
    if (search) q.set('search', search);
    if (role) q.set('role', role);
    return api.get(`/admin/users?${q}`).then(setUsers).catch((e) => setError(e.message));
  };

  useEffect(() => { load(); }, [role]); // search runs on submit

  const openNew = () => { setForm(EMPTY_FORM); setEditingId(null); setShowForm(true); };
  const openEdit = (u) => { setForm({ name: u.name, email: u.email, password: '', role: u.role }); setEditingId(u.id); setShowForm(true); };
  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editingId) await api.put(`/admin/users/${editingId}`, form);
      else await api.post('/admin/users', form);
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const onDelete = async (u) => {
    const orders = u.order_count ? ` Their ${u.order_count} order(s), cart and reviews will be deleted too.` : '';
    if (!window.confirm(`Delete ${u.name} (${u.email})?${orders}`)) return;
    setError('');
    try {
      await api.del(`/admin/users/${u.id}`);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <>
      <div className="page-head">
        <h1>Users</h1>
        <button className="btn btn-primary" onClick={openNew}>+ New user</button>
      </div>
      {error && <p className="alert alert-error">{error}</p>}

      {showForm && (
        <form className="card form form-grid" onSubmit={onSubmit}>
          <h3 className="span-2">{editingId ? `Edit user #${editingId}` : 'New user'}</h3>
          <label>Name<input name="name" value={form.name} onChange={onChange} required /></label>
          <label>Email<input type="email" name="email" value={form.email} onChange={onChange} required /></label>
          <label>
            Password {editingId && <span className="muted small">— leave empty to keep the current one</span>}
            <input type="password" name="password" value={form.password} onChange={onChange} minLength="6" required={!editingId} autoComplete="new-password" />
          </label>
          <label>
            Role
            <select name="role" value={form.role} onChange={onChange}>
              <option value="customer">Customer</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          {editingId === me?.id && <p className="span-2 muted small">This is your own account. Role changes take effect the next time you log in.</p>}
          <div className="span-2 actions">
            <button type="button" className="btn" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="btn btn-primary">{editingId ? 'Save changes' : 'Create user'}</button>
          </div>
        </form>
      )}

      <form className="admin-filters" onSubmit={(e) => { e.preventDefault(); load(); }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or email…" aria-label="Search users" />
        <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role">
          <option value="">All roles</option>
          <option value="customer">Customers</option>
          <option value="admin">Admins</option>
        </select>
        <button className="btn">Search</button>
      </form>

      <div className="card table-wrap">
        <table>
          <thead>
            <tr><th>ID</th><th>Name</th><th>Email</th><th>Role</th><th>Orders</th><th>Spent</th><th>Joined</th><th></th></tr>
          </thead>
          <tbody>
            {users.length === 0 && <tr><td colSpan="8" className="muted">No users found.</td></tr>}
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.id}</td>
                <td>{u.name}{u.id === me?.id && <span className="muted small"> (you)</span>}</td>
                <td>{u.email}</td>
                <td><span className={`status ${u.role === 'admin' ? 'status-shipped' : 'status-cancelled'}`}>{u.role}</span></td>
                <td>{u.order_count}</td>
                <td>{money(u.total_spent)}</td>
                <td>{formatDate(u.created_at)}</td>
                <td className="row-actions">
                  <button className="btn btn-sm" onClick={() => openEdit(u)}>Edit</button>
                  <button className="btn btn-sm btn-danger" onClick={() => onDelete(u)} disabled={u.id === me?.id}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
