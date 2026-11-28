import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Check, CheckCheck, Clock, HandHelping, Loader2, QrCode, XCircle } from 'lucide-react';
import { api } from '../../api';
import Logo from '../../ui/Logo';
import ThemeToggle from '../../ui/ThemeToggle';
import { SERVICE_LABEL, ago, mmss } from '../../services';

const FINAL = ['completed', 'rejected', 'expired'];

// the three steps the customer sees
function Steps({ status }) {
  const step = status === 'pending' ? 0 : status === 'approved' ? 1 : 2;
  const labels = ['Submitted', 'Accepted', 'Completed'];
  return (
    <ol className="mt-6 grid grid-cols-3 gap-2">
      {labels.map((label, i) => {
        const done = i <= step && !(status === 'rejected' && i > 0);
        return (
          <li key={label} className="text-center">
            <div className={'mx-auto grid h-9 w-9 place-items-center rounded-full text-sm font-bold transition ' + (done ? 'bg-accent text-on-accent' : 'border border-line bg-card text-muted')}>
              {done ? <Check size={18} /> : i + 1}
            </div>
            <p className={'mt-2 text-xs font-bold ' + (done ? 'text-ink' : 'text-muted')}>{label}</p>
          </li>
        );
      })}
    </ol>
  );
}

export default function Track() {
  const { token } = useParams();
  const { state } = useLocation();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [missing, setMissing] = useState(false);
  const [skew, setSkew] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api(`/public/track/${token}`);
      setSkew(Date.parse(d.serverTime) - Date.now());
      setData(d);
      setError('');
    } catch (e) {
      if (e.status === 404) setMissing(true);
      else setError('Connection lost. Retrying…');
    }
  }, [token]);

  useEffect(() => {
    load();
    const poll = setInterval(() => {
      if (!document.hidden) load();
    }, 3000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [load]);

  async function act(path) {
    setBusy(true);
    try {
      await api(`/public/track/${token}/${path}`, { method: 'POST' });
      await load();
    } catch (e) {
      setError(e.status === 429 ? `Please wait ${e.data?.retryAfterSeconds ?? 'a few'}s before raising it again.` : e.message);
    } finally {
      setBusy(false);
    }
  }

  const shell = (children) => (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 pb-10 pt-5">
      <div className="mb-8 flex items-center justify-between">
        <Logo size={26} />
        <ThemeToggle />
      </div>
      {children}
    </div>
  );

  if (missing) {
    return shell(
      <div className="rise mt-10 rounded-3xl border border-line bg-card p-8 text-center">
        <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-warn-soft text-warn">
          <QrCode />
        </div>
        <h1 className="text-xl font-extrabold">This link is not valid</h1>
        <p className="mt-2 text-muted">Please scan the QR code on your table again.</p>
      </div>,
    );
  }

  if (!data) {
    return shell(
      <div className="grid flex-1 place-items-center text-muted">
        <Loader2 className="animate-spin" />
      </div>,
    );
  }

  const r = data.request;
  const serverNow = now + skew;
  const raiseIn = r.remindAvailableAt ? (Date.parse(r.remindAvailableAt) - serverNow) / 1000 : null;
  const qr = localStorage.getItem('attend.qr.' + token);

  const view = {
    pending: [Clock, state?.fresh ? 'Your request has been sent!' : 'Your request is with the staff', 'Staff will assist you shortly.'],
    approved: [HandHelping, 'Staff accepted your request', 'Help is on the way.'],
    completed: [CheckCheck, 'All done!', 'Thank you. Need anything else?'],
    rejected: [XCircle, 'Request declined', r.rejectReason || 'The staff could not take this request. Please ask a team member.'],
    expired: [XCircle, 'Request closed', 'This request was closed automatically.'],
  }[r.status] || [Clock, 'Request received', ''];
  const [Icon, title, text] = view;
  const bad = r.status === 'rejected' || r.status === 'expired';

  return shell(
    <>
      <p className="text-sm font-semibold text-muted">
        {data.venue} · {data.branch.name}
      </p>
      <span className="mt-2 inline-flex w-fit rounded-full bg-accent-soft px-4 py-1.5 text-sm font-bold text-accent">Table {data.table.number}</span>

      <section className="rise mt-6 rounded-3xl border border-line bg-card p-6 text-center">
        <div className={'mx-auto grid h-16 w-16 place-items-center rounded-full ' + (bad ? 'bg-danger-soft text-danger' : 'bg-accent-soft text-accent')}>
          <Icon size={30} />
        </div>
        <h1 className="mt-4 text-2xl font-extrabold leading-tight">{title}</h1>
        <p className="mt-2 text-muted">{text}</p>
        <Steps status={r.status} />
        <p className="mt-6 text-sm text-muted">
          {SERVICE_LABEL[r.type]} · sent {ago(r.createdAt, serverNow)}
        </p>
      </section>

      {r.status === 'approved' && (
        <div className="mt-5 grid gap-3">
          <button
            onClick={() => act('complete')}
            disabled={busy}
            className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-accent text-base font-extrabold text-on-accent transition active:scale-[0.98] disabled:opacity-60"
          >
            {busy ? <Loader2 className="animate-spin" size={20} /> : 'Mark as completed'}
          </button>
          <button
            onClick={() => act('raise')}
            disabled={busy || raiseIn > 0}
            className="h-12 rounded-2xl border border-line bg-card text-sm font-bold text-muted transition enabled:text-ink enabled:hover:border-accent disabled:opacity-60"
          >
            {raiseIn > 0 ? `Nobody came? You can raise it again in ${mmss(raiseIn)}` : 'Nobody came? Raise it again'}
          </button>
        </div>
      )}

      {FINAL.includes(r.status) && qr && (
        <Link to={`/t/${qr}`} className="mt-5 flex h-14 items-center justify-center rounded-2xl bg-accent text-base font-extrabold text-on-accent">
          Request something else
        </Link>
      )}

      {error && <p className="mt-4 rounded-xl bg-warn-soft p-3 text-center text-sm font-semibold text-warn">{error}</p>}
      <p className="mt-6 text-center text-xs text-muted">Keep this page. You can come back to it any time to see the status.</p>
    </>,
  );
}