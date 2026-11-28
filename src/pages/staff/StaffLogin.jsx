import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../auth';
import Logo from '../../ui/Logo';
import ThemeToggle from '../../ui/ThemeToggle';

export default function StaffLogin() {
  const { token, login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (token) return <Navigate to="/staff" replace />;

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(username, password);
      navigate('/staff');
    } catch (err) {
      setError(err.status === 429 ? 'Too many attempts. Please wait a minute.' : err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative grid min-h-screen place-items-center px-5">
      <ThemeToggle className="absolute right-5 top-5" />
      <form onSubmit={submit} className="rise w-full max-w-sm rounded-3xl border border-line bg-card p-8 shadow-sm">
        <Logo size={34} />
        <h1 className="mt-6 text-2xl font-extrabold tracking-tight">Staff sign in</h1>
        <p className="mt-1 text-sm text-muted">Use the login given to your branch.</p>

        <label className="mt-6 block text-sm font-bold" htmlFor="u">
          Username
        </label>
        <input
          id="u"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          required
          autoFocus
          placeholder="e.g. kfc_salt_lake_staff"
          className="mt-2 h-12 w-full rounded-xl border border-line bg-bg px-4 outline-none focus:border-accent"
        />
        <label className="mt-4 block text-sm font-bold" htmlFor="p">
          Password
        </label>
        <input
          id="p"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          className="mt-2 h-12 w-full rounded-xl border border-line bg-bg px-4 outline-none focus:border-accent"
        />
        {error && <p className="mt-4 rounded-xl bg-danger-soft p-3 text-sm font-semibold text-danger">{error}</p>}
        <button disabled={busy} className="mt-6 flex h-12 w-full items-center justify-center rounded-xl bg-accent font-extrabold text-on-accent transition active:scale-[0.98] disabled:opacity-60">
          {busy ? <Loader2 className="animate-spin" size={20} /> : 'Sign in'}
        </button>
      </form>
    </div>
  );
}