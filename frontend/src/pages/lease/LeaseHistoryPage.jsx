// Person A: all of the user's saved lease checks, newest first, with client-side filters.
import { Link, useSearchParams } from 'react-router-dom';
import { listAnalyses } from '../../api.js';
import useApi from '../../useApi.js';
import LeaseError from './LeaseError.jsx';
import { ToneChip } from './LeaseReport.jsx';
import { VERDICT_TONES, formatters } from './format.js';
import { LangScope } from '../../i18n.jsx';
import { useT } from './strings.js';

const ALL = '';

function HistoryRow({ a, search }) {
  const t = useT();
  const f = formatters(t.lang);
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
            {t('rooms', a.rooms)} · {f.eur(a.rent_eur)} {t('perMonth')}
          </span>
          <span className="small muted">
            <time dateTime={a.created_at}>{f.date(a.created_at)}</time>
          </span>
        </span>
        <span className="lease-history-page-chips">
          {a.overall_risk ? (
            <ToneChip kind="risk" value={a.overall_risk} />
          ) : (
            <span className="lease-chip lease-tone-none">{t('noReport')}</span>
          )}
          <ToneChip kind="verdict" value={a.verdict} />
        </span>
      </Link>
    </li>
  );
}

export default function LeaseHistoryPage() {
  const t = useT();
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
    <LangScope>
      <section className="hero">
        <p className="small lease-history-page-crumb">
          <Link to="/lease">{t('history.back')}</Link>
        </p>
        <h1>{t('history.title')}</h1>
        <p className="lead">{t('history.lead')}</p>
      </section>

      <section className="card" aria-labelledby="lease-history-page-title">
        <h2 id="lease-history-page-title" className="lease-history-page-title">
          {t('history.all')}
        </h2>

        <LeaseError error={error} onRetry={reload} />

        {loading && !data && (
          <p className="muted" role="status">
            {t('history.loading')}
          </p>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="lease-history-page-empty">
            <p>
              <strong>{t('history.empty')}</strong>
            </p>
            <p className="muted">{t('history.emptyHint')}</p>
            <Link to="/lease" className="btn btn-primary">
              {t('history.checkOne')}
            </Link>
          </div>
        )}

        {items.length > 0 && (
          <>
            <div className="lease-history-page-filters" role="group" aria-label={t('history.filters')}>
              <label className="field">
                <span className="field-label">{t('neighbourhood')}</span>
                <select className="input" value={hood} onChange={(e) => setFilter('neighbourhood', e.target.value)}>
                  <option value={ALL}>{t('history.allHoods')}</option>
                  {hoods.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                  {hood !== ALL && !hoods.includes(hood) && <option value={hood}>{hood}</option>}
                </select>
              </label>
              <label className="field">
                <span className="field-label">{t('history.verdict')}</span>
                <select className="input" value={verdict} onChange={(e) => setFilter('verdict', e.target.value)}>
                  <option value={ALL}>{t('history.allVerdicts')}</option>
                  {Object.keys(VERDICT_TONES).map((key) => (
                    <option key={key} value={key}>
                      {t(`verdict.${key}`)}
                    </option>
                  ))}
                  {verdict !== ALL && !(verdict in VERDICT_TONES) && <option value={verdict}>{verdict}</option>}
                </select>
              </label>
            </div>

            <div className="lease-history-page-count">
              <p className="small muted" role="status" aria-live="polite">
                {t('history.count', shown.length, items.length)}
              </p>
              <button type="button" className="btn btn-sm" onClick={reset} disabled={!filtered}>
                {t('history.reset')}
              </button>
            </div>

            {shown.length === 0 ? (
              <p className="muted lease-history-page-none">{t('history.noMatch')}</p>
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
    </LangScope>
  );
}
