import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await register(form.name, form.email, form.password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form className="card form auth-form" onSubmit={onSubmit}>
      <h1>Create account</h1>
      {error && <p className="alert alert-error">{error}</p>}
      <label>Name<input name="name" value={form.name} onChange={onChange} required /></label>
      <label>Email<input type="email" name="email" value={form.email} onChange={onChange} required /></label>
      <label>
        Password
        <input type="password" name="password" minLength="6" value={form.password} onChange={onChange} required />
      </label>
      <button className="btn btn-primary btn-block">Sign up</button>
      <p>Already have an account? <Link to="/login">Log in</Link></p>
    </form>
  );
}
