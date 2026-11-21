import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth';

const TYPES = { staff: 'Call staff', supplies: 'Water / Supplies', bill: 'Request bill', other: 'Other assistance' };
const REASONS = ['Not available right now', 'Please ask at the counter', 'Duplicate request'];

const mmss = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
};
const level = (ms) => (ms > 300000 ? 'late' : ms > 120000 ? 'warn' : '');
const clock = (iso) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export default function Requests() {
  const { request } = useAuth();
  const [queue, setQueue] = useState({ needsAction: [], inProgress: [] });
  const [history, setHistory] = useState([]);
  const [tab, setTab] = useState('action');
  const [skew, setSkew] = useState(0); // difference between the server clock and this computer's clock
  const [now, setNow] = useState(Date.now());
  const [rejecting, setRejecting] = useState(null);
  const [sound, setSound] = useState(false);
  const [error, setError] = useState('');
  const seen = useRef(null);
  const soundOn = useRef(false);

  useEffect(() => {
    soundOn.current = sound;
  }, [sound]);

  const beep = useCallback(() => {
    if (!soundOn.current) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.value = 0.08;
      osc.start();
      setTimeout(() => {
        osc.stop();
        ctx.close();
      }, 180);
    } catch {
      /* sound is optional */
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const q = await request('/requests');
      setSkew(Date.parse(q.serverTime) - Date.now());
      setQueue(q);
      setError('');
      // beep when a new request arrives, or a customer reminds again
      const sig = new Map(q.needsAction.map((r) => [r.id, r.reminders]));
      if (seen.current) {
        for (const [id, n] of sig) {
          if (!seen.current.has(id) || seen.current.get(id) < n) {
            beep();
            break;
          }
        }
      }
      seen.current = sig;
    } catch (e) {
      setError(e.message);
    }
  }, [request, beep]);

  // check for new requests every 3 seconds, and tick the waiting timers every second
  useEffect(() => {
    load();
    const poll = setInterval(load, 3000);
    const clockTick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(clockTick);
    };
  }, [load]);

  useEffect(() => {
    if (tab !== 'history') return;
    request('/requests/history')
      .then(setHistory)
      .catch((e) => setError(e.message));
  }, [tab, request]);

  async function act(id, action, body) {
    setError('');
    try {
      await request(`/requests/${id}/${action}`, { method: 'PATCH', body });
      setRejecting(null);
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  const waited = (iso) => now + skew - Date.parse(iso);

  function pendingCard(r) {
    const ms = waited(r.createdAt);
    return (
      <div key={r.id} className={'card req ' + level(ms)}>
        <div className="req-head">
          <div>
            <div className="table-no">Table {r.table.number}</div>
            <div className="what">{TYPES[r.type] || r.type}</div>
            <div className="muted">
              {r.branch.name}
              {r.details ? ' · ' + r.details : ''}
            </div>
          </div>
          <div className="timer">
            {mmss(ms)}
            <span className="muted">waiting · asked {clock(r.createdAt)}</span>
          </div>
        </div>
        {r.reminders > 0 && <span className="badge">Reminded ×{r.reminders}</span>}
        {rejecting === r.id ? (
          <div className="reasons">
            {REASONS.map((why) => (
              <button key={why} className="chip" onClick={() => act(r.id, 'reject', { reason: why })}>
                {why}
              </button>
            ))}
            <button className="chip" onClick={() => setRejecting(null)}>
              Back
            </button>
          </div>
        ) : (
          <div className="row">
            <button className="btn" onClick={() => act(r.id, 'approve')}>
              Approve
            </button>
            <button className="btn secondary" onClick={() => setRejecting(r.id)}>
              Reject
            </button>
          </div>
        )}
      </div>
    );
  }

  function progressCard(r) {
    return (
      <div key={r.id} className="card req">
        <div className="req-head">
          <div>
            <div className="table-no">Table {r.table.number}</div>
            <div className="what">{TYPES[r.type] || r.type}</div>
            <div className="muted">{r.branch.name}</div>
          </div>
          <div className="timer">
            {mmss(waited(r.approvedAt))}
            <span className="muted">since approval</span>
          </div>
        </div>
        <span className="badge solid">Approved</span>
        <div className="row">
          <button className="btn secondary small" onClick={() => act(r.id, 'close')}>
            Close request
          </button>
          <span className="muted" style={{ alignSelf: 'center' }}>
            Clears when the customer marks it completed.
          </span>
        </div>
      </div>
    );
  }

  function historyCard(r) {
    return (
      <div key={r.id} className="card req">
        <div className="req-head">
          <div>
            <div className="table-no">Table {r.table.number}</div>
            <div className="what">{TYPES[r.type] || r.type}</div>
          </div>
          <div className="muted">{r.closedAt ? clock(r.closedAt) : ''}</div>
        </div>
        <span className="badge grey">
          {r.status}
          {r.closedBy ? ` (${r.closedBy})` : ''}
        </span>
        {r.rejectReason && <span className="muted">{r.rejectReason}</span>}
      </div>
    );
  }

  const n = queue.needsAction.length;
  const p = queue.inProgress.length;
  const items = tab === 'action' ? queue.needsAction : tab === 'progress' ? queue.inProgress : history;
  const render = tab === 'action' ? pendingCard : tab === 'progress' ? progressCard : historyCard;

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <div className="logo">ATTEND</div>
          <div className="muted">Live requests</div>
        </div>
        <div className="actions">
          <button className="btn secondary" onClick={() => setSound((s) => !s)}>
            {sound ? 'Sound on' : 'Sound off'}
          </button>
          <Link className="btn secondary" to="/">
            Dashboard
          </Link>
        </div>
      </header>

      <div className="chips tabs">
        <button className={'chip' + (tab === 'action' ? ' active' : '')} onClick={() => setTab('action')}>
          Needs action ({n})
        </button>
        <button className={'chip' + (tab === 'progress' ? ' active' : '')} onClick={() => setTab('progress')}>
          In progress ({p})
        </button>
        <button className={'chip' + (tab === 'history' ? ' active' : '')} onClick={() => setTab('history')}>
          History
        </button>
      </div>

      {error && <p className="error">{error}</p>}
      {items.length === 0 && (
        <p className="muted center">
          {tab === 'action' ? 'No one needs help right now.' : tab === 'progress' ? 'Nothing waiting on a customer.' : 'Finished requests will appear here.'}
        </p>
      )}
      {items.map(render)}
    </div>
  );
}