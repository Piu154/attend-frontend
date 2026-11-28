// The ATTEND mark: a bell on a teal tile, plus the wordmark.
export default function Logo({ size = 28, text = true }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="9" style={{ fill: 'var(--accent)' }} />
        <path
          d="M16 7.5a6 6 0 0 0-6 6v3.2l-1.6 2.7a.8.8 0 0 0 .7 1.2h13.8a.8.8 0 0 0 .7-1.2L22 16.7v-3.2a6 6 0 0 0-6-6Zm-2.4 14.5a2.4 2.4 0 0 0 4.8 0Z"
          style={{ fill: 'var(--on-accent)' }}
        />
      </svg>
      {text && (
        <span className="font-extrabold tracking-[0.16em]" style={{ fontSize: size * 0.55 }}>
          ATTEND
        </span>
      )}
    </span>
  );
}