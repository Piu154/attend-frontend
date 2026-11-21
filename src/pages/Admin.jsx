import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';

const TABS = ['pending', 'approved', 'rejected', 'suspended'];
const KEY = 'attend.adminKey';

export default function Admin() {
  const [adminKey, setAdminKey] = useState(() => sessionStorage.getItem(KEY) || '');
  const [input, setInput] = useState('');
  const [tab, setTab] = useState('pending');
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState('');

  const signOut = useCallback(() => {
    sessionStorage.removeItem(KEY);
    setAdminKey('');
    setRows([]);
  }, []);

  const load = useCallback(async () => {
    if (!adminKey) return;
    setError('');
    setLoading(true);
    try {
      setRows(await api(`/admin/restaurants?status=${tab}`, { adminKey }));
    } catch (e) {
      if (e.status === 401) {
        signOut();
        setError('Wrong admin key.');
      } else {
        setError(e.message);
      }
    } finally {
      setLoading(false);
    }
  }, [adminKey, tab, signOut]);

  useEffect(() => {
    load();
  }, [load]);

  function saveKey(e) {
    e.preventDefault();
    const key = input.trim();
    if (!key) return;
    sessionStorage.setItem(KEY, key);
    setAdminKey(key);
    setInput('');
    setError('');
  }

  async function act(id, action) {
    setBusyId(id);
    setError('');
    try {
      await api(`/admin/restaurants/${id}/${action}`, { method: 'PATCH', adminKey });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId('');
    }
  }

  if (!adminKey) {
    return (
      <div className="auth-page">
        <form className="card auth-card" onSubmit={saveKey}>
          <div className="logo">ATTEND</div>
          <h1>Admin</h1>
          <label>
            Admin key (ADMIN_API_KEY from the backend .env)
            <input type="password" value={input} onChange={(e) => setInput(e.target.value)} autoComplete="off" required autoFocus />
          </label>
          {error && <p className="error">{error}</p>}
          <button className="btn">Open admin</button>
        </form>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <div className="logo">ATTEND</div>
          <div className="muted">Admin · restaurant approvals</div>
        </div>
        <button className="btn secondary" onClick={signOut}>
          Sign out
        </button>
      </header>

      <div className="chips tabs">
        {TABS.map((t) => (
          <button key={t} className={'chip' + (t === tab ? ' active' : '')} onClick={() => setTab(t)}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
        <button className="chip" onClick={load} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      <section className="card">
        {rows.length === 0 && !loading && <p className="muted">No {tab} restaurants.</p>}
        <ul className="list">
          {rows.map((r) => (
            <li key={r.id}>
              <span className="grow">
                <strong>{r.name}</strong>
                <br />
                <span className="muted">
                  {r.email} · registered {new Date(r.createdAt).toLocaleString()}
                </span>
              </span>
              <span className="actions">
                {(r.status === 'pending' || r.status === 'rejected' || r.status === 'suspended') && (
                  <button className="btn small" disabled={busyId === r.id} onClick={() => act(r.id, 'approve')}>
                    {r.status === 'pending' ? 'Approve' : 'Reactivate'}
                  </button>
                )}
                {r.status === 'pending' && (
                  <button className="btn small secondary" disabled={busyId === r.id} onClick={() => act(r.id, 'reject')}>
                    Reject
                  </button>
                )}
                {r.status === 'approved' && (
                  <button className="btn small secondary" disabled={busyId === r.id} onClick={() => act(r.id, 'suspend')}>
                    Suspend
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}