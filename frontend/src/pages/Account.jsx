import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, formatDate, timeAgo } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { ShieldIcon } from '../components/Icons.jsx';

// "Mozilla/5.0 (Windows NT 10.0; ...) Chrome/126 ..." -> "Chrome on Windows"
function deviceName(ua = '') {
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome'
    : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : ua ? 'Browser' : 'Unknown device';
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS'
    : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  return os ? `${browser} on ${os}` : browser;
}

export default function Account() {
  const { user, logoutEverywhere, endSession } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [saving, setSaving] = useState(false);

  const loadSessions = () => api.get('/auth/sessions').then(setSessions).catch((e) => setError(e.message));
  useEffect(() => { loadSessions(); }, []);

  const revoke = async (s) => {
    setError('');
    try {
      await api.del(`/auth/sessions/${s.id}`);
      if (s.current) {
        endSession();
        return navigate('/login', { state: { message: 'You logged out this device.' } });
      }
      loadSessions();
    } catch (e) {
      setError(e.message);
    }
  };

  const everywhere = async () => {
    if (!window.confirm('Log out on all devices, including this one?')) return;
    try {
      await logoutEverywhere();
      navigate('/login', { state: { message: 'You were logged out on all devices.' } });
    } catch (e) {
      setError(e.message);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    if (pw.newPassword !== pw.confirm) return setError('The new passwords do not match');
    setSaving(true);
    try {
      await api.put('/auth/password', { currentPassword: pw.currentPassword, newPassword: pw.newPassword });
      setPw({ currentPassword: '', newPassword: '', confirm: '' });
      setMessage('Password changed. All other devices were logged out.');
      loadSessions();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <h1>Account &amp; security</h1>
      {error && <p className="alert alert-error">{error}</p>}
      {message && <p className="alert alert-success">{message}</p>}

      <div className="two-col">
        <div className="card">
          <h3>Profile</h3>
          <p>
            <strong>{user.name}</strong><br />
            {user.email}<br />
            <span className={`status ${user.role === 'admin' ? 'status-shipped' : 'status-cancelled'}`}>{user.role}</span>
          </p>

          <h3>Change password</h3>
          <form className="form" onSubmit={changePassword}>
            <label>Current password
              <input type="password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} autoComplete="current-password" required />
            </label>
            <label>New password
              <input type="password" minLength="8" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} autoComplete="new-password" required />
              <span className="muted small">At least 8 characters, with a letter and a number</span>
            </label>
            <label>Repeat new password
              <input type="password" minLength="8" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} autoComplete="new-password" required />
            </label>
            <button className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Change password'}</button>
          </form>
        </div>

        <div className="card">
          <h3><ShieldIcon width={18} height={18} /> Where you're logged in</h3>
          <p className="muted small">
            Each login has its own refresh token. Log out a device you don't recognise — it can't get new access tokens anymore.
          </p>
          {sessions === null ? <p className="muted">Loading…</p> : (
            <ul className="session-list">
              {sessions.map((s) => (
                <li key={s.id}>
                  <div>
                    <strong>{deviceName(s.user_agent)}</strong> {s.current && <span className="status pay-paid">this device</span>}
                    <div className="muted small">
                      Signed in {formatDate(s.signed_in_at)} · last active {timeAgo(s.last_used_at)}{s.ip ? ` · IP ${s.ip}` : ''}
                    </div>
                  </div>
                  <button className="btn btn-sm" onClick={() => revoke(s)}>Log out</button>
                </li>
              ))}
            </ul>
          )}
          <button className="btn btn-danger btn-block" onClick={everywhere}>Log out everywhere</button>
        </div>
      </div>
    </>
  );
}
