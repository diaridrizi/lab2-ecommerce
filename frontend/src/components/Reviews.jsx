import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api, formatDate } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import Stars, { StarInput } from './Stars.jsx';

// Reviews (MongoDB) on the product page: everyone can read them,
// logged-in customers can write one review per product and edit or delete it.
export default function Reviews({ productId }) {
  const { user } = useAuth();
  const location = useLocation();
  const [data, setData] = useState(null); // { reviews, count, average, breakdown }
  const [form, setForm] = useState({ rating: 0, title: '', body: '' });
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => api.get(`/reviews?productId=${productId}`).then(setData).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [productId]); // eslint-disable-line react-hooks/exhaustive-deps

  const mine = user && data?.reviews.find((r) => r.userId === user.id);
  const showForm = user && (!mine || editing);

  const startEdit = () => {
    setForm({ rating: mine.rating, title: mine.title, body: mine.body });
    setEditing(true);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.rating) return setError('Please choose a star rating.');
    setSaving(true);
    setError('');
    try {
      if (mine) await api.put(`/reviews/${mine._id}`, form);
      else await api.post('/reviews', { productId, ...form });
      setEditing(false);
      setForm({ rating: 0, title: '', body: '' });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!window.confirm('Delete your review?')) return;
    try {
      await api.del(`/reviews/${mine._id}`);
      setEditing(false);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  if (!data) return null;

  return (
    <section className="reviews section" id="reviews">
      <div className="section-head"><h2 className="section-title">Reviews</h2></div>
      <div className="reviews-layout">
        <aside className="reviews-summary">
          <div className="reviews-average">
            <strong>{data.count ? data.average.toFixed(1) : '–'}</strong>
            <div>
              <Stars value={data.average} size={20} />
              <span className="muted small">{data.count} {data.count === 1 ? 'review' : 'reviews'}</span>
            </div>
          </div>
          {data.breakdown.map((b) => (
            <div key={b.stars} className="reviews-bar">
              <span>{b.stars}★</span>
              <span className="reviews-bar-track"><span style={{ width: `${data.count ? (b.count / data.count) * 100 : 0}%` }} /></span>
              <span className="muted">{b.count}</span>
            </div>
          ))}
        </aside>

        <div className="reviews-main">
          {error && <p className="alert alert-error">{error}</p>}

          {!user && (
            <p className="reviews-login">
              <Link to="/login" state={{ from: location.pathname }}>Log in</Link> to write a review.
            </p>
          )}

          {mine && !editing && (
            <div className="review my-review">
              <div className="review-head">
                <span className="pbadge">Your review</span>
                <div className="row-actions">
                  <button className="btn btn-sm" onClick={startEdit}>Edit</button>
                  <button className="btn btn-sm btn-danger" onClick={onDelete}>Delete</button>
                </div>
              </div>
              <Stars value={mine.rating} />
              {mine.title && <h4>{mine.title}</h4>}
              {mine.body && <p>{mine.body}</p>}
            </div>
          )}

          {showForm && (
            <form className="review-form form" onSubmit={onSubmit}>
              <h4>{mine ? 'Edit your review' : 'Write a review'}</h4>
              <StarInput value={form.rating} onChange={(rating) => setForm({ ...form, rating })} />
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title (e.g. Great fit!)" maxLength="120" />
              <textarea rows="3" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="What did you like or dislike?" maxLength="2000" />
              <div className="actions">
                {editing && <button type="button" className="btn" onClick={() => setEditing(false)}>Cancel</button>}
                <button className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : mine ? 'Save review' : 'Post review'}</button>
              </div>
            </form>
          )}

          {data.reviews.filter((r) => r._id !== mine?._id).map((r, i) => (
            <article key={r._id} className="review" style={{ '--i': i }}>
              <div className="review-head">
                <strong>{r.userName}</strong>
                <span className="muted small">{formatDate(r.createdAt)}</span>
              </div>
              <Stars value={r.rating} />
              {r.title && <h4>{r.title}</h4>}
              {r.body && <p>{r.body}</p>}
            </article>
          ))}

          {data.count === 0 && !showForm && <p className="muted">No reviews yet. Be the first!</p>}
        </div>
      </div>
    </section>
  );
}
