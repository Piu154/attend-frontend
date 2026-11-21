import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', ownerName: '', password: '' });
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api('/restaurants/register', { method: 'POST', body: form });
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="auth-page">
        <div className="card auth-card">
          <div className="logo">ATTEND</div>
          <h1>Registered</h1>
          <p>
            Your restaurant is waiting for approval by the ATTEND team. You can already sign in to see its status.
          </p>
          <Link className="btn center-btn" to="/login">
            Go to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <form className="card auth-card" onSubmit={handleSubmit}>
        <div className="logo">ATTEND</div>
        <h1>Register your restaurant</h1>
        <label>
          Restaurant name
          <input value={form.name} onChange={set('name')} required minLength={2} maxLength={120} />
        </label>
        <label>
          Email (this is also your login)
         <input type="email" value={form.email} onChange={set('email')} required autoComplete="email" />
        </label>
        <label>
          Your name
          <input value={form.ownerName} onChange={set('ownerName')} required minLength={2} maxLength={120} />
        </label>
        <label>
          Password (at least 8 characters)
         <input type="password" value={form.password} onChange={set('password')} required minLength={8} maxLength={100} autoComplete="new-password" />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn" disabled={busy}>
          {busy ? 'Registering…' : 'Register'}
        </button>
        <p className="muted center">
          Already registered? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </div>
  );
}