// Person A: all of the user's saved lease checks, newest first, with client-side filters.
import { Link, useSearchParams } from 'react-router-dom';
import { listAnalyses } from '../../api.js';
import ErrorBox from '../../components/ErrorBox.jsx';
import useApi from '../../useApi.js';
import { ToneChip } from './LeaseReport.jsx';
import { RISKS, VERDICTS, formatDate, formatEur, roomsLabel } from './format.js';

const ALL = '';

function HistoryRow({ a, search }) {
  return (
    <li>
      <Link
        to={`/lease/history/${a.id}`}
        state={{ from: search }}
        className="lease-history-page-row"
      >
        <span className="lease-history-page-main">
          <strong>{a.neighbourhood}</strong>
          <span>
            {roomsLabel(a.rooms)} · {formatEur(a.rent_eur)} a month
          </span>
          <span className="small muted">
            <time dateTime={a.created_at}>{formatDate(a.created_at)}</time>
          </span>
        </span>
        <span className="lease-history-page-chips">
          {a.overall_risk ? (
            <ToneChip map={RISKS} value={a.overall_risk} />
          ) : (
            <span className="lease-chip lease-tone-none">No report</span>
          )}
          <ToneChip map={VERDICTS} value={a.verdict} />
        </span>
      </Link>
    </li>
  );
}

export default function LeaseHistoryPage() {
  const { data, loading, error, reload } = useApi(listAnalyses);
  const items = data || [];

  // Filters live in the URL so "Back to all checks" and reloads keep them.
  const [params, setParams] = useSearchParams();
  const hood = params.get('neighbourhood') || ALL;
  const verdict = params.get('verdict') || ALL;

  const setFilter = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };
  const reset = () => setParams({}, { replace: true });

  const hoods = [...new Set(items.map((a) => a.neighbourhood))].sort((x, y) => x.localeCompare(y, 'ro'));
  const shown = items.filter(
    (a) => (hood === ALL || a.neighbourhood === hood) && (verdict === ALL || a.verdict === verdict),
  );
  const filtered = hood !== ALL || verdict !== ALL;
  const search = params.toString() ? `?${params}` : '';

  return (
    <>
      <section className="hero">
        <p className="small lease-history-page-crumb">
          <Link to="/lease">← Lease check</Link>
        </p>
        <h1>Your lease checks</h1>
        <p className="lead">Every lease you have checked, newest first. Open one to see the full report.</p>
      </section>

      <section className="card" aria-labelledby="lease-history-page-title">
        <h2 id="lease-history-page-title" className="lease-history-page-title">
          All checks
        </h2>

        <ErrorBox error={error} onRetry={reload} />

        {loading && !data && (
          <p className="muted" role="status">
            Loading your checks…
          </p>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="lease-history-page-empty">
            <p>
              <strong>No checks yet.</strong>
            </p>
            <p className="muted">When you check a lease, it is saved here so you can come back to it.</p>
            <Link to="/lease" className="btn btn-primary">
              Check a lease
            </Link>
          </div>
        )}

        {items.length > 0 && (
          <>
            <div className="lease-history-page-filters" role="group" aria-label="Filter checks">
              <label className="field">
                <span className="field-label">Neighbourhood</span>
                <select className="input" value={hood} onChange={(e) => setFilter('neighbourhood', e.target.value)}>
                  <option value={ALL}>All neighbourhoods</option>
                  {hoods.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                  {hood !== ALL && !hoods.includes(hood) && <option value={hood}>{hood}</option>}
                </select>
              </label>
              <label className="field">
                <span className="field-label">Price verdict</span>
                <select className="input" value={verdict} onChange={(e) => setFilter('verdict', e.target.value)}>
                  <option value={ALL}>All verdicts</option>
                  {Object.entries(VERDICTS).map(([key, v]) => (
                    <option key={key} value={key}>
                      {v.label}
                    </option>
                  ))}
                  {verdict !== ALL && !(verdict in VERDICTS) && <option value={verdict}>{verdict}</option>}
                </select>
              </label>
            </div>

            <div className="lease-history-page-count">
              <p className="small muted" role="status" aria-live="polite">
                {shown.length} of {items.length} {items.length === 1 ? 'check' : 'checks'}
              </p>
              <button type="button" className="btn btn-sm" onClick={reset} disabled={!filtered}>
                Reset filters
              </button>
            </div>

            {shown.length === 0 ? (
              <p className="muted lease-history-page-none">No checks match these filters.</p>
            ) : (
              <ul className="list lease-history-page-list">
                {shown.map((a) => (
                  <HistoryRow key={a.id} a={a} search={search} />
                ))}
              </ul>
            )}
          </>
        )}
      </section>
    </>
  );
}
