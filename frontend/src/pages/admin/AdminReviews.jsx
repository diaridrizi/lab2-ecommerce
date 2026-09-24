import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatDate } from '../../api.js';
import Stars, { StarInput } from '../../components/Stars.jsx';

// Reviews (MongoDB): customers create them on the product page; the admin can read, edit and delete them here
export default function AdminReviews() {
  const [reviews, setReviews] = useState([]);
  const [rating, setRating] = useState('');
  const [editing, setEditing] = useState(null); // { _id, rating, title, body }
  const [error, setError] = useState('');

  const load = () => api.get(`/admin/reviews${rating ? `?rating=${rating}` : ''}`).then(setReviews).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [rating]);

  const run = async (fn) => {
    setError('');
    try {
      await fn();
      setEditing(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const onSave = (e) => {
    e.preventDefault();
    run(() => api.put(`/admin/reviews/${editing._id}`, { rating: editing.rating, title: editing.title, body: editing.body }));
  };

  const onDelete = (r) => {
    if (!window.confirm(`Delete the review by ${r.userName}?`)) return;
    run(() => api.del(`/admin/reviews/${r._id}`));
  };

  return (
    <>
      <div className="page-head">
        <h1>Reviews</h1>
        <select value={rating} onChange={(e) => setRating(e.target.value)} aria-label="Filter by rating">
          <option value="">All ratings</option>
          {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} stars</option>)}
        </select>
      </div>
      <p className="muted">Customers write reviews on product pages. You can edit (e.g. to remove bad language) or delete them.</p>
      {error && <p className="alert alert-error">{error}</p>}

      <div className="card table-wrap">
        <table>
          <thead><tr><th>Product</th><th>Customer</th><th>Rating</th><th>Review</th><th>Date</th><th></th></tr></thead>
          <tbody>
            {reviews.length === 0 && <tr><td colSpan="6" className="muted">No reviews yet.</td></tr>}
            {reviews.map((r) =>
              editing?._id === r._id ? (
                <tr key={r._id} className="selected">
                  <td colSpan="6">
                    <form className="form review-edit" onSubmit={onSave}>
                      <strong>Editing review by {r.userName} on {r.product?.name ?? `product #${r.productId}`}</strong>
                      <StarInput value={editing.rating} onChange={(v) => setEditing({ ...editing, rating: v })} />
                      <input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="Title" maxLength="120" />
                      <textarea rows="3" value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} maxLength="2000" />
                      <div className="actions">
                        <button type="button" className="btn btn-sm" onClick={() => setEditing(null)}>Cancel</button>
                        <button className="btn btn-sm btn-primary">Save</button>
                      </div>
                    </form>
                  </td>
                </tr>
              ) : (
                <tr key={r._id}>
                  <td>{r.product ? <Link to={`/products/${r.product.slug}`}>{r.product.name}</Link> : <span className="muted">Deleted product #{r.productId}</span>}</td>
                  <td>{r.userName}<div className="muted small">user #{r.userId}</div></td>
                  <td><Stars value={r.rating} /></td>
                  <td className="review-cell"><strong>{r.title}</strong><div className="muted small">{r.body}</div></td>
                  <td>{formatDate(r.createdAt)}</td>
                  <td className="row-actions">
                    <button className="btn btn-sm" onClick={() => setEditing({ _id: r._id, rating: r.rating, title: r.title, body: r.body })}>Edit</button>
                    <button className="btn btn-sm btn-danger" onClick={() => onDelete(r)}>Delete</button>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
