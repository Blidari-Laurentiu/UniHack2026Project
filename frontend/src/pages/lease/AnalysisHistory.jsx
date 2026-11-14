import LeaseError from './LeaseError.jsx';
import { ToneChip } from './LeaseReport.jsx';
import { formatters } from './format.js';
import { useT } from './strings.js';

export default function AnalysisHistory({ items, loading, error, onRetry, selectedId, openingId, onOpen, disabled }) {
  const t = useT();
  const f = formatters(t.lang);
  return (
    <>
      <LeaseError error={error} onRetry={onRetry} />
      {loading && items.length === 0 && <p className="muted">{t('history.loading')}</p>}
      {!loading && !error && items.length === 0 && <p className="muted">{t('history.emptyShort')}</p>}
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
                  {a.neighbourhood} · {t('rooms', a.rooms)} · {f.eur(a.rent_eur)}
                </strong>
                <span className="small muted">
                  {openingId === a.id ? t('history.opening') : f.date(a.created_at)}
                </span>
              </span>
              <span className="list-side">
                {a.overall_risk ? (
                  <ToneChip kind="risk" value={a.overall_risk} />
                ) : (
                  <span className="lease-chip lease-tone-none">{t('noReport')}</span>
                )}
                <ToneChip kind="verdict" value={a.verdict} />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
