import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, BellOff, CheckCheck, Clock, LogOut, Search, Wifi, WifiOff } from 'lucide-react';
import { useAuth } from '../../auth';
import Logo from '../../ui/Logo';
import ThemeToggle from '../../ui/ThemeToggle';
import { SERVICE_LABEL, ago, clock } from '../../services';

const REASONS = ['Not available right now', 'Please ask at the counter', 'Duplicate request'];
const TABS = [['all', 'All'], ['new', 'New'], ['handled', 'Being handled'], ['done', 'Completed']];
const DONE_LABEL = { completed: 'Completed', rejected: 'Declined', expired: 'Expired' };

export default function StaffBoard() {
  const { request, logout, branch, restaurant } = useAuth();
  const [queue, setQueue] = useState({ needsAction: [], inProgress: [] });
  const [history, setHistory] = useState([]);
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [skew, setSkew] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [online, setOnline] = useState(true);
  const [sound, setSound] = useState(() => localStorage.getItem('attend.sound') === 'on');
  const [declining, setDeclining] = useState(null);
  const [notice, setNotice] = useState('');
  const seen = useRef(null);
  const soundOn = useRef(sound);
  const overdueAfter = useRef(300);

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
      osc.stop(ctx.currentTime + 0.2);
      setTimeout(() => ctx.close(), 400);
    } catch {
      /* sound is optional, the screen always shows new requests */
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const [q, h] = await Promise.all([request('/requests'), request('/requests/history')]);
      setSkew(Date.parse(q.serverTime) - Date.now());
      overdueAfter.current = q.overdueAfterSeconds || 300;
      setQueue(q);
      setHistory(h);
      setOnline(true);
      const ids = new Set(q.needsAction.map((r) => r.id));
      if (seen.current && [...ids].some((id) => !seen.current.has(id))) beep(); // a new request arrived
      seen.current = ids;
    } catch (e) {
      if (e.status !== 401) setOnline(false);
    }
  }, [request, beep]);

  // check for changes every 3 seconds, and tick the clock every second
  useEffect(() => {
    load();
    const poll = setInterval(load, 3000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [load]);

  useEffect(() => {
    const n = queue.needsAction.length;
    document.title = (n ? `(${n}) ` : '') + 'ATTEND Staff';
  }, [queue]);

  function toggleSound() {
    const next = !sound;
    setSound(next);
    localStorage.setItem('attend.sound', next ? 'on' : 'off');
  }

  async function act(id, action, body) {
    setNotice('');
    try {
      await request(`/requests/${id}/${action}`, { method: 'PATCH', body });
      setDeclining(null);
    } catch (e) {
      // two people tapped at the same moment: the first one won
      if (e.status === 409 || e.status === 404) setNotice('Someone already handled this request.');
      else setNotice(e.message);
    }
    load();
  }

  const serverNow = now + skew;
  const all = [
    ...queue.needsAction.map((r) => ({ ...r, group: 'new' })),
    ...queue.inProgress.map((r) => ({ ...r, group: 'handled' })),
    ...history.map((r) => ({ ...r, group: 'done' })),
  ];
  const counts = { all: all.length, new: queue.needsAction.length, handled: queue.inProgress.length, done: history.length };
  const term = search.trim().toLowerCase();
  const shown = all.filter((r) => (tab === 'all' || r.group === tab) && (!term || String(r.table.number).toLowerCase().includes(term)));
  const overdueCount = queue.needsAction.filter((r) => r.overdue).length;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-line bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
          <Logo size={28} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-extrabold">
              {restaurant?.name}
              {branch ? ` · ${branch.name}` : ''}
            </p>
          </div>
          <span className={'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ' + (online ? 'bg-ok-soft text-ok' : 'bg-danger-soft text-danger')}>
            {online ? <Wifi size={14} /> : <WifiOff size={14} />}
            {online ? 'Live' : 'Offline'}
          </span>
          <span className="hidden text-sm font-bold tabular-nums text-muted sm:block">{new Date(now).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
          <button
            onClick={toggleSound}
            aria-pressed={sound}
            aria-label={sound ? 'Mute new request sound' : 'Turn on new request sound'}
            className={'grid h-10 w-10 place-items-center rounded-full border border-line ' + (sound ? 'bg-accent-soft text-accent' : 'bg-card text-muted')}
          >
            {sound ? <Bell size={18} /> : <BellOff size={18} />}
          </button>
          <ThemeToggle />
          <button onClick={logout} aria-label="Sign out" className="grid h-10 w-10 place-items-center rounded-full border border-line bg-card text-muted hover:text-ink">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-6">
        {!online && (
          <p role="alert" className="mb-4 rounded-2xl bg-danger-soft p-3 text-center text-sm font-bold text-danger">
            Connection lost. New requests may be missing. Reconnecting…
          </p>
        )}
        {overdueCount > 0 && (
          <p role="alert" className="mb-4 rounded-2xl bg-danger p-3 text-center text-sm font-extrabold text-white">
            {overdueCount} request{overdueCount > 1 ? 's have' : ' has'} been waiting too long. Please attend now.
          </p>
        )}
        {notice && <p className="mb-4 rounded-2xl bg-warn-soft p-3 text-center text-sm font-bold text-warn">{notice}</p>}

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-2">
            {TABS.map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={'rounded-full px-4 py-2 text-sm font-bold transition ' + (tab === key ? 'bg-accent text-on-accent' : 'border border-line bg-card text-muted hover:text-ink')}
              >
                {label} <span className="opacity-70">{counts[key]}</span>
              </button>
            ))}
          </div>
          <label className="relative ml-auto w-full sm:w-56">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search table number"
              inputMode="numeric"
              className="h-11 w-full rounded-full border border-line bg-card pl-10 pr-4 text-sm outline-none focus:border-accent"
            />
          </label>
        </div>

        {shown.length === 0 && (
          <div className="mt-16 text-center text-muted">
            <CheckCheck className="mx-auto mb-3" size={36} />
            <p className="font-bold">{term ? 'No requests for that table.' : tab === 'done' ? 'Finished requests will appear here.' : 'All clear. New requests appear here instantly.'}</p>
          </div>
        )}

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((r) => {
            const fresh = r.group === 'new' && serverNow - Date.parse(r.createdAt) < 60000;
            const tone =
              r.group === 'done' ? 'border-line opacity-75' : r.overdue ? 'border-danger bg-danger-soft' : r.group === 'handled' ? 'border-accent/50 bg-accent-soft/40' : 'border-line';
            return (
              <article key={r.id} className={'rise rounded-3xl border bg-card p-5 shadow-sm ' + tone + (fresh ? ' ring-2 ring-accent' : '')}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-muted">Table</p>
                    <p className="text-4xl font-extrabold leading-none tracking-tight">{r.table.number}</p>
                  </div>
                  <span
                    className={
                      'rounded-full px-3 py-1 text-xs font-extrabold uppercase tracking-wide ' +
                      (r.group === 'new' ? (r.overdue ? 'bg-danger text-white' : 'bg-accent text-on-accent') : r.group === 'handled' ? 'bg-ok-soft text-ok' : 'bg-line text-muted')
                    }
                  >
                    {r.group === 'new' ? (r.overdue ? 'Overdue' : r.reminders ? 'Raised again' : 'New') : r.group === 'handled' ? 'Being handled' : DONE_LABEL[r.status]}
                  </span>
                </div>

                <p className="mt-4 text-lg font-extrabold">{SERVICE_LABEL[r.type] || r.type}</p>
                {r.details && <p className="mt-1 rounded-xl bg-bg px-3 py-2 text-sm">“{r.details}”</p>}
                <p className="mt-3 flex items-center gap-1.5 text-sm text-muted">
                  <Clock size={14} /> Received {ago(r.createdAt, serverNow)} · {clock(r.createdAt)}
                </p>
                {r.acceptedBy && r.group !== 'new' && <p className="mt-1 text-sm text-muted">Accepted by {r.acceptedBy}</p>}
                {r.rejectReason && <p className="mt-1 text-sm text-muted">Reason: {r.rejectReason}</p>}

                {r.group === 'new' &&
                  (declining === r.id ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {REASONS.map((why) => (
                        <button key={why} onClick={() => act(r.id, 'reject', { reason: why })} className="rounded-full border border-line bg-card px-3 py-2 text-xs font-bold hover:border-danger">
                          {why}
                        </button>
                      ))}
                      <button onClick={() => setDeclining(null)} className="px-2 text-xs font-bold text-muted">
                        Back
                      </button>
                    </div>
                  ) : (
                    <div className="mt-4 flex gap-2">
                      <button onClick={() => act(r.id, 'approve')} className="h-12 flex-1 rounded-2xl bg-accent font-extrabold text-on-accent transition active:scale-[0.98]">
                        Accept request
                      </button>
                      <button onClick={() => setDeclining(r.id)} className="h-12 rounded-2xl border border-line px-4 text-sm font-bold text-muted hover:text-ink">
                        Decline
                      </button>
                    </div>
                  ))}

                {r.group === 'handled' && (
                  <button onClick={() => act(r.id, 'close')} className="mt-4 h-12 w-full rounded-2xl bg-ink font-extrabold text-bg transition active:scale-[0.98]">
                    Mark completed
                  </button>
                )}
              </article>
            );
          })}
        </div>
      </main>
    </div>
  );
}