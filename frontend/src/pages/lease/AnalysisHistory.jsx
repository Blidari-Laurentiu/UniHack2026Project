import ErrorBox from '../../components/ErrorBox.jsx';
import { ToneChip } from './LeaseReport.jsx';
import { RISKS, VERDICTS, formatDate, formatEur, roomsLabel } from './format.js';

export default function AnalysisHistory({ items, loading, error, onRetry, selectedId, openingId, onOpen, disabled }) {
  return (
    <>
      <ErrorBox error={error} onRetry={onRetry} />
      {loading && items.length === 0 && <p className="muted">Loading your checks…</p>}
      {!loading && !error && items.length === 0 && (
        <p className="muted">No checks yet. Your past lease checks will show up here.</p>
      )}
      <ul className="list lease-history">
        {items.map((a) => (
          <li key={a.id}>
            <button
              type="button"
              className={`lease-history-item${a.id === selectedId ? ' lease-history-active' : ''}`}
              onClick={() => onOpen(a.id)}
              disabled={disabled}
              aria-current={a.id === selectedId ? 'true' : undefined}
            >
              <span className="list-main">
                <strong>
                  {a.neighbourhood} · {roomsLabel(a.rooms)} · {formatEur(a.rent_eur)}
                </strong>
                <span className="small muted">
                  {openingId === a.id ? 'Opening…' : formatDate(a.created_at)}
                </span>
              </span>
              <span className="list-side">
                {a.overall_risk ? (
                  <ToneChip map={RISKS} value={a.overall_risk} />
                ) : (
                  <span className="lease-chip lease-tone-none">No report</span>
                )}
                <ToneChip map={VERDICTS} value={a.verdict} />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
