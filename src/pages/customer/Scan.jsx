import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BellRing, BookOpen, ChevronLeft, Loader2, MessageCircle, QrCode, Receipt } from 'lucide-react';
import { api } from '../../api';
import Logo from '../../ui/Logo';
import ThemeToggle from '../../ui/ThemeToggle';
import { SERVICE_LABEL } from '../../services';

// icon, short hint, and the question asked before sending
const META = {
  bill: [Receipt, 'Ask for your bill', 'Would you like to request your bill?'],
  menu: [BookOpen, 'See the menu', 'Would you like to request the menu?'],
  staff: [BellRing, 'Get someone’s attention', 'Would you like to call a staff member?'],
  other: [MessageCircle, 'Something else', 'Would you like to ask for other assistance?'],
};

function Shell({ children }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 pb-10 pt-5">
      <div className="mb-8 flex items-center justify-between">
        <Logo size={26} />
        <ThemeToggle />
      </div>
      {children}
    </div>
  );
}

export default function Scan() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [phase, setPhase] = useState('loading'); // loading | ready | unavailable | error
  const [info, setInfo] = useState(null);
  const [open, setOpen] = useState(null); // a request already open for this table
  const [choice, setChoice] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const i = await api(`/public/qr/${token}`);
        const c = await api(`/public/qr/${token}/requests/current`);
        if (!alive) return;
        const request = c.request && ['pending', 'approved'].includes(c.request.status) ? c.request : null;
        const tracking = localStorage.getItem('attend.track.' + token);
        if (request && tracking) return navigate(`/track/${tracking}`, { replace: true }); // this phone already has the link
        setInfo(i);
        setOpen(request);
        setPhase('ready');
      } catch (e) {
        if (alive) setPhase(e.status === 404 ? 'unavailable' : 'error');
      }
    })();
    return () => {
      alive = false;
    };
  }, [token, navigate]);

  async function send() {
    setBusy(true);
    setError('');
    try {
      const res = await api(`/public/qr/${token}/requests`, { method: 'POST', body: { type: choice, details: note.trim() || undefined } });
      if (res.trackingToken) {
        localStorage.setItem('attend.track.' + token, res.trackingToken);
        localStorage.setItem('attend.qr.' + res.trackingToken, token);
        navigate(`/track/${res.trackingToken}`, { replace: true, state: { fresh: true } });
      } else {
        setOpen(res.request); // the table already had an open request
        setChoice(null);
      }
    } catch (e) {
      setError(e.status === 429 ? 'Too many attempts. Please wait a moment.' : e.message);
    } finally {
      setBusy(false);
    }
  }

  if (phase === 'loading') {
    return (
      <Shell>
        <div className="grid flex-1 place-items-center text-muted">
          <Loader2 className="animate-spin" />
        </div>
      </Shell>
    );
  }

  if (phase !== 'ready') {
    return (
      <Shell>
        <div className="rise mt-10 rounded-3xl border border-line bg-card p-8 text-center">
          <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-warn-soft text-warn">
            <QrCode />
          </div>
          <h1 className="text-xl font-extrabold">{phase === 'error' ? 'Something went wrong' : 'This table is currently unavailable'}</h1>
          <p className="mt-2 text-muted">
            {phase === 'error' ? 'Please check your connection and scan again.' : 'Please contact the staff for assistance.'}
          </p>
        </div>
      </Shell>
    );
  }

  const services = info.services;

  return (
    <Shell>
      <header className="rise">
        <p className="text-sm font-semibold text-muted">Welcome to</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight">{info.restaurant.name}</h1>
        <p className="mt-1 text-muted">{info.branch.name}</p>
        <span className="mt-4 inline-flex rounded-full bg-accent-soft px-4 py-1.5 text-sm font-bold text-accent">Table {info.table.number}</span>
      </header>

      {open && (
        <div className="rise mt-8 rounded-3xl border border-accent/40 bg-accent-soft p-5">
          <p className="font-extrabold">Your request is already with the staff</p>
          <p className="mt-1 text-sm text-muted">
            {SERVICE_LABEL[open.type]} · {open.status === 'approved' ? 'Staff accepted it and are on the way.' : 'Staff will assist you shortly.'}
          </p>
        </div>
      )}

      {!open && !choice && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted">How can we help?</h2>
          <div className="grid grid-cols-2 gap-3">
            {services.map((s, i) => {
              const [Icon, hint] = META[s.key];
              return (
                <button
                  key={s.key}
                  onClick={() => setChoice(s.key)}
                  style={{ animationDelay: `${i * 50}ms` }}
                  className="rise flex min-h-36 flex-col items-start justify-between rounded-3xl border border-line bg-card p-4 text-left shadow-sm transition active:scale-[0.97] hover:border-accent"
                >
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent-soft text-accent">
                    <Icon size={24} />
                  </span>
                  <span>
                    <span className="block text-base font-extrabold leading-tight">{s.label}</span>
                    <span className="mt-0.5 block text-xs text-muted">{hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {!open && choice && (
        <section className="rise mt-8 rounded-3xl border border-line bg-card p-6">
          <button onClick={() => { setChoice(null); setError(''); }} className="-ml-1 mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted">
            <ChevronLeft size={16} /> Go back
          </button>
          <h2 className="text-xl font-extrabold leading-snug">{META[choice][2]}</h2>
          <p className="mt-1 text-sm text-muted">
            For Table {info.table.number}, {info.branch.name}.
          </p>
          <label className="mt-5 block text-sm font-bold" htmlFor="note">
            Add a note <span className="font-medium text-muted">(optional)</span>
          </label>
          <textarea
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={300}
            rows={3}
            placeholder={choice === 'other' ? 'Tell us what you need' : 'For example: split the bill in two'}
            className="mt-2 w-full resize-none rounded-2xl border border-line bg-bg p-3 text-sm outline-none focus:border-accent"
          />
          {error && <p className="mt-3 rounded-xl bg-danger-soft p-3 text-sm font-semibold text-danger">{error}</p>}
          <button
            onClick={send}
            disabled={busy}
            className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-accent text-base font-extrabold text-on-accent transition active:scale-[0.98] disabled:opacity-60"
          >
            {busy ? <Loader2 className="animate-spin" size={20} /> : 'Confirm request'}
          </button>
        </section>
      )}
    </Shell>
  );
}