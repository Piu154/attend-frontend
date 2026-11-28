export const SERVICE_LABEL = {
  bill: 'Request Bill',
  menu: 'Request Menu',
  staff: 'Call Staff',
  other: 'Other Assistance',
  supplies: 'Water / Supplies', // old requests
};

export const clock = (iso) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

// "just now", "3 min ago", "1 h 5 min ago"
export function ago(iso, now) {
  const seconds = Math.max(0, Math.floor((now - Date.parse(iso)) / 1000));
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min ago`;
}

export const mmss = (seconds) => {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};