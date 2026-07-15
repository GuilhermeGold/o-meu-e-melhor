export default function Timer({ seconds, total }) {
  if (seconds == null) return null;
  const pct = total ? Math.max(0, Math.min(100, (seconds / total) * 100)) : 0;
  const urgent = seconds <= 10;
  return (
    <div className="timer">
      <div className="timer-bar-track">
        <div
          className={`timer-bar-fill ${urgent ? 'is-urgent' : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`timer-label ${urgent ? 'is-urgent' : ''}`}>{seconds}s</span>
    </div>
  );
}
