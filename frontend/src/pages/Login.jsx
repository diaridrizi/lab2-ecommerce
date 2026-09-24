import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const user = await login(email, password);
      // Go back to the page that asked for login, or to the right home page
      navigate(location.state?.from || (user.role === 'admin' ? '/admin' : '/'), { replace: true });
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form className="card form auth-form" onSubmit={onSubmit}>
      <h1>Log in</h1>
      {/* e.g. "You were logged out on this device." after "log out everywhere" */}
      {location.state?.message && !error && <p className="alert alert-warning">{location.state.message}</p>}
      {error && <p className="alert alert-error">{error}</p>}
      <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></label>
      <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required /></label>
      <button className="btn btn-primary btn-block">Log in</button>
      <p className="muted small">
        Demo accounts: <code>customer@shop.local / customer123</code> · <code>admin@shop.local / admin123</code>
      </p>
      <p>No account? <Link to="/register">Sign up</Link></p>
    </form>
  );
}
