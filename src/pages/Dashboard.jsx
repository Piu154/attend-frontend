import { useEffect, useState } from 'react';
import { useAuth } from '../auth';

export default function Dashboard() {
  const { user, restaurant, request, logout } = useAuth();
  const canManage = user?.role === 'owner' || user?.role === 'manager';

  const [status, setStatus] = useState(restaurant?.status);
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState('');
  const [tables, setTables] = useState([]);
  const [qr, setQr] = useState(null); // the QR just created, so it can be shown and downloaded
  const [error, setError] = useState('');
  const [branchForm, setBranchForm] = useState({ branchName: '', address: '' });
  const [tableNumber, setTableNumber] = useState('');

  // load the branches once the restaurant is approved
  useEffect(() => {
    if (status !== 'approved') return;
    request('/branches')
      .then((list) => {
        setBranches(list);
        setBranchId((current) => current || list[0]?.id || '');
      })
      .catch((e) => setError(e.message));
  }, [status, request]);

  // load the tables whenever another branch is selected
  useEffect(() => {
    setQr(null);
    if (!branchId) {
      setTables([]);
      return;
    }
    request(`/branches/${branchId}/tables`)
      .then(setTables)
      .catch((e) => setError(e.message));
  }, [branchId, request]);

  async function checkStatus() {
    setError('');
    try {
      const r = await request('/restaurants/me');
      setStatus(r.status);
    } catch (e) {
      setError(e.message);
    }
  }

  async function addBranch(e) {
    e.preventDefault();
    setError('');
    try {
      const b = await request('/branches', { method: 'POST', body: branchForm });
      setBranches((list) => [...list, b]);
      setBranchId(b.id);
      setBranchForm({ branchName: '', address: '' });
    } catch (err) {
      setError(err.message);
    }
  }

  async function addTable(e) {
    e.preventDefault();
    setError('');
    try {
      const t = await request(`/branches/${branchId}/tables`, { method: 'POST', body: { tableNumber } });
      setTables((list) => [...list, { id: t.id, branchId, tableNumber: t.tableNumber, isActive: true }]);
      setQr({ tableNumber: t.tableNumber, ...t.qr });
      setTableNumber('');
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleTable(t) {
    setError('');
    try {
      const updated = await request(`/tables/${t.id}`, { method: 'PATCH', body: { isActive: !t.isActive } });
      setTables((list) => list.map((x) => (x.id === t.id ? { ...x, isActive: updated.isActive } : x)));
    } catch (err) {
      setError(err.message);
    }
  }

  async function newQr(t) {
    if (!window.confirm(`Create a new QR for table ${t.tableNumber}? The old QR will stop working.`)) return;
    setError('');
    try {
      const r = await request(`/tables/${t.id}/qr/regenerate`, { method: 'POST' });
      setQr({ tableNumber: r.tableNumber, ...r.qr });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <div className="logo">ATTEND</div>
          <div className="muted">
            {restaurant?.name} · {user?.name} ({user?.role})
          </div>
        </div>
        <button className="btn secondary" onClick={logout}>
          Sign out
        </button>
      </header>

      {error && <p className="error">{error}</p>}

      {status !== 'approved' ? (
        <div className="card">
          <h2>Waiting for approval</h2>
          <p>
            Your restaurant is <strong>{status}</strong>. Once the ATTEND team approves it, you can add branches and
            tables.
          </p>
          <button className="btn" onClick={checkStatus}>
            Check again
          </button>
        </div>
      ) : (
        <>
          <section className="card">
            <h2>Branches</h2>
            {branches.length === 0 && <p className="muted">No branches yet.</p>}
            <div className="chips">
              {branches.map((b) => (
                <button
                  key={b.id}
                  className={'chip' + (b.id === branchId ? ' active' : '')}
                  onClick={() => setBranchId(b.id)}
                >
                  {b.branchName}
                </button>
              ))}
            </div>
            {canManage && (
              <form className="row" onSubmit={addBranch}>
                <input
                  placeholder="Branch name"
                  value={branchForm.branchName}
                  onChange={(e) => setBranchForm({ ...branchForm, branchName: e.target.value })}
                  required
                />
                <input
                  placeholder="Address"
                  value={branchForm.address}
                  onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })}
                  required
                />
                <button className="btn">Add branch</button>
              </form>
            )}
          </section>

          {branchId && (
            <section className="card">
              <h2>Tables</h2>
              {tables.length === 0 && <p className="muted">No tables in this branch yet.</p>}
              <ul className="list">
                {tables.map((t) => (
                  <li key={t.id} className={t.isActive ? '' : 'inactive'}>
                    <strong>Table {t.tableNumber}</strong>
                    <span className="muted">{t.isActive ? 'Active' : 'Disabled'}</span>
                    {canManage && (
                      <span className="actions">
                        <button className="btn small secondary" onClick={() => newQr(t)}>
                          New QR
                        </button>
                        <button className="btn small secondary" onClick={() => toggleTable(t)}>
                          {t.isActive ? 'Disable' : 'Enable'}
                        </button>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              {canManage && (
                <form className="row" onSubmit={addTable}>
                  <input
                    placeholder="Table number, e.g. 12"
                    value={tableNumber}
                    onChange={(e) => setTableNumber(e.target.value)}
                    required
                    maxLength={20}
                  />
                  <button className="btn">Add table</button>
                </form>
              )}
            </section>
          )}

          {qr && (
            <section className="card qr">
              <h2>QR for table {qr.tableNumber}</h2>
              <img src={qr.imageDataUrl} alt={`QR code for table ${qr.tableNumber}`} />
              <p className="muted break">{qr.url}</p>
              <a className="btn" href={qr.imageDataUrl} download={`table-${qr.tableNumber}.png`}>
                Download PNG
              </a>
              <p className="muted">Print this now. For security the QR can’t be shown again later, only replaced with “New QR”.</p>
            </section>
          )}
        </>
      )}
    </div>
  );
}