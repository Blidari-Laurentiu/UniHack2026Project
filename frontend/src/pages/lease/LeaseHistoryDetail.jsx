// Person A: one saved lease check at its own URL (/lease/history/:id), so it can be linked and reloaded.
import { Link, useLocation, useParams } from 'react-router-dom';
import { getAnalysis } from '../../api.js';
import ErrorBox from '../../components/ErrorBox.jsx';
import useApi from '../../useApi.js';
import AnalysisResult from './AnalysisResult.jsx';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function notFoundError() {
  const err = new Error('analysis not found');
  err.status = 404;
  return err;
}

export default function LeaseHistoryDetail() {
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
    <>
      <p className="small lease-history-page-crumb">
        <Link to={backTo}>← Back to all checks</Link>
      </p>

      {loading && (
        <section className="card">
          <p className="muted" role="status">
            Loading this check…
          </p>
        </section>
      )}

      {!loading && notFound && (
        <section className="card lease-history-page-notfound" aria-labelledby="lease-history-page-nf">
          <h1 id="lease-history-page-nf">Check not found</h1>
          <p className="muted">
            This lease check does not exist, or it belongs to another account. Check the link, or
            pick one from your list.
          </p>
          <div className="form-actions">
            <Link to="/lease/history" className="btn btn-primary">
              See all checks
            </Link>
            <Link to="/lease" className="btn">
              Check a lease
            </Link>
          </div>
        </section>
      )}

      {!loading && error && !notFound && (
        <section className="card">
          <h1>Lease check</h1>
          <ErrorBox error={error} onRetry={reload} />
        </section>
      )}

      {!loading && data && (
        <section className="card" aria-labelledby="lease-history-page-detail-title">
          <h1 id="lease-history-page-detail-title" className="lease-history-page-detail-title">
            Lease check: {data.neighbourhood}
          </h1>
          <AnalysisResult analysis={data} />
        </section>
      )}
    </>
  );
}
