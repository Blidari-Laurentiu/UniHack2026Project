// Person A: one saved lease check at its own URL (/lease/history/:id), so it can be linked and reloaded.
import { Link, useLocation, useParams } from 'react-router-dom';
import { getAnalysis } from '../../api.js';
import useApi from '../../useApi.js';
import AnalysisResult from './AnalysisResult.jsx';
import LeaseError from './LeaseError.jsx';
import { LangScope, LangSwitch } from './i18n.jsx';
import { useT } from './strings.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function notFoundError() {
  const err = new Error('analysis not found');
  err.status = 404;
  return err;
}

export default function LeaseHistoryDetail() {
  const t = useT();
  const { id } = useParams();
  const location = useLocation();
  // Keep the list filters when going back (they come from the list link's state).
  const from = typeof location.state?.from === 'string' ? location.state.from : '';
  const backTo = `/lease/history${from}`;

  // A malformed id can never exist; the API would answer 422, so treat it as not found up front.
  const { data, loading, error, reload } = useApi(
    () => (UUID_RE.test(id) ? getAnalysis(id) : Promise.reject(notFoundError())),
    [id],
  );
  const notFound = error?.status === 404 || error?.status === 422;

  return (
    <LangScope>
      <div className="lease-lang-bar">
        <p className="small lease-history-page-crumb">
          <Link to={backTo}>{t('detail.back')}</Link>
        </p>
        <LangSwitch />
      </div>

      {loading && (
        <section className="card">
          <p className="muted" role="status">
            {t('detail.loading')}
          </p>
        </section>
      )}

      {!loading && notFound && (
        <section className="card lease-history-page-notfound" aria-labelledby="lease-history-page-nf">
          <h1 id="lease-history-page-nf">{t('detail.notFound')}</h1>
          <p className="muted">{t('detail.notFoundHint')}</p>
          <div className="form-actions">
            <Link to="/lease/history" className="btn btn-primary">
              {t('detail.seeAll')}
            </Link>
            <Link to="/lease" className="btn">
              {t('history.checkOne')}
            </Link>
          </div>
        </section>
      )}

      {!loading && error && !notFound && (
        <section className="card">
          <h1>{t('page.title')}</h1>
          <LeaseError error={error} onRetry={reload} />
        </section>
      )}

      {!loading && data && (
        <section className="card" aria-labelledby="lease-history-page-detail-title">
          <h1 id="lease-history-page-detail-title" className="lease-history-page-detail-title">
            {t('detail.title', data.neighbourhood)}
          </h1>
          <AnalysisResult analysis={data} />
        </section>
      )}
    </LangScope>
  );
}
