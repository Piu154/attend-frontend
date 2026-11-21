import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth';

const TYPES = { staff: 'Call staff', supplies: 'Water / Supplies', bill: 'Request bill', other: 'Other assistance' };
const REASONS = ['Not available right now', 'Please ask at the counter', 'Duplicate request'];

const mmss = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
};
const clock = (iso) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const nice = (sec) => (sec >= 60 ? `${Math.round(sec / 60)} min` : `${sec} sec`);

export default function Requests() {
  const { request } = useAuth();
  const [queue, setQueue] = useState({ needsAction: [], inProgress: [] });
  const [history, setHistory] = useState([]);
  const [tab, setTab] = useState('action');
  const [overdueAfter, setOverdueAfter] = useState(300); // seconds before a request counts as overdue
  const [skew, setSkew] = useState(0); // difference between the server clock and this computer's clock
  const [now, setNow] = useState(Date.now());
  const [rejecting, setRejecting] = useState(null);
  const [sound, setSound] = useState(false);
  const [error, setError] = useState('');
  const seen = useRef(null);
  const seenOverdue = useRef(new Set());
  const soundOn = useRef(false);

  useEffect(() => {
    soundOn.current = sound;
  }, [sound]);

  // one beep for a new request or a customer resend, two lower beeps for an overdue request
  const beep = useCallback((times = 1) => {
    if (!soundOn.current) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      for (let i = 0; i < times; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = times > 1 ? 660 : 880;
        gain.gain.value = 0.08;
        osc.start(ctx.currentTime + i * 0.3);
        osc.stop(ctx.currentTime + i * 0.3 + 0.18);
      }
      setTimeout(() => ctx.close(), times * 300 + 300);
    } catch {
      /* sound is optional */
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const q = await request('/requests');
      setSkew(Date.parse(q.serverTime) - Date.now());
      setOverdueAfter(q.overdueAfterSeconds || 300);
      setQueue(q);
      setError('');

      const sig = new Map(q.needsAction.map((r) => [r.id, r.reminders]));
      const late = q.needsAction.filter((r) => r.overdue).map((r) => r.id);
      if (seen.current) {
        if (late.some((id) => !seenOverdue.current.has(id))) {
          beep(2); // something just became overdue
        } else {
          for (const [id, n] of sig) {
            if (!seen.current.has(id) || seen.current.get(id) < n) {
              beep(1); // new request, or the customer resent it
              break;
            }
          }
        }
      }
      seen.current = sig;
      seenOverdue.current = new Set(late);
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

  // the browser tab title shows how many need attention, even when you are on another tab
  useEffect(() => {
    const late = queue.needsAction.filter((r) => r.overdue).length;
    const n = queue.needsAction.length;
    document.title = (late ? `(${late} overdue) ` : n ? `(${n}) ` : '') + 'ATTEND';
  }, [queue]);
  useEffect(() => () => { document.title = 'ATTEND'; }, []);

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
  const levelOf = (ms) => (ms > overdueAfter * 1000 ? 'late' : ms > overdueAfter * 400 ? 'warn' : '');

  function pendingCard(r) {
    const ms = waited(r.createdAt);
    const late = r.overdue || ms > overdueAfter * 1000;
    return (
      <div key={r.id} className={'card req ' + levelOf(ms)}>
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
        <div>
          {late && <span className="badge solid">Overdue</span>}
          {!late && !r.reminders && ms < 60000 && <span className="badge">New</span>}
          {r.reminders > 0 && <span className="badge">Re-raised ×{r.reminders}</span>}
          {r.bellAt && <span className="badge grey">Bell sent {clock(r.bellAt)}</span>}
        </div>
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
            <button className="btn secondary" disabled={!!r.bellAt} onClick={() => act(r.id, 'bell')}>
              {r.bellAt ? 'Bell sent' : '🔔 Send bell'}
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
  const lateCount = queue.needsAction.filter((r) => r.overdue || waited(r.createdAt) > overdueAfter * 1000).length;
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

      {lateCount > 0 && (
        <div className="alert" role="alert">
          Overdue: {lateCount} request{lateCount > 1 ? 's have' : ' has'} been waiting more than {nice(overdueAfter)}. Please attend now.
        </div>
      )}

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