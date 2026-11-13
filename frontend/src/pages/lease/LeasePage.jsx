// Person A owns this folder: lease form, loading state, result (price badge + report) and history.
import { useEffect, useRef, useState } from 'react';
import { analyzeLease, getAnalysis, getNeighbourhoods, listAnalyses } from '../../api.js';
import { LoginButton, useAuth } from '../../auth/index.js';
import ErrorBox from '../../components/ErrorBox.jsx';
import useApi from '../../useApi.js';
import AnalysisHistory from './AnalysisHistory.jsx';
import AnalysisResult from './AnalysisResult.jsx';
import LeaseForm, { EMPTY_FORM } from './LeaseForm.jsx';

function useElapsedSeconds(running) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!running) return undefined;
    const start = Date.now();
    setSeconds(0);
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [running]);
  return seconds;
}

export default function LeasePage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const hoods = useApi(getNeighbourhoods);
  const neighbourhoods = (hoods.data || []).map((n) => n.name);

  const history = useApi(
    () => (isAuthenticated ? listAnalyses() : Promise.resolve([])),
    [isAuthenticated],
  );

  const [values, setValues] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [openingId, setOpeningId] = useState(null);
  const elapsed = useElapsedSeconds(busy);
  const resultRef = useRef(null);

  const showResult = (analysis) => {
    setResult(analysis);
    // Wait for the render, then bring the result into view (on phones it is below the form).
    requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  async function submit(payload) {
    if (inFlight.current) return; // no double submits
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const analysis = await analyzeLease(payload);
      showResult(analysis);
      history.reload();
    } catch (err) {
      setError(err); // the form keeps its values
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function openAnalysis(id) {
    if (inFlight.current || openingId) return;
    setOpeningId(id);
    setError(null);
    try {
      showResult(await getAnalysis(id));
    } catch (err) {
      setError(err);
    } finally {
      setOpeningId(null);
    }
  }

  const locked = !isAuthenticated;

  return (
    <>
      <section className="hero">
        <h1>Lease check</h1>
        <p className="lead">
          Paste your rental contract. We flag risky clauses, list what is missing and compare the
          rent with similar flats in the neighbourhood.
        </p>
      </section>

      <section className="card">
        <h2>Your lease</h2>
        {!authLoading && locked && (
          <div className="lease-login">
            <span>Log in to check a lease and keep your past checks.</span>
            <LoginButton className="btn btn-primary btn-sm" />
          </div>
        )}

        <ErrorBox error={hoods.error} onRetry={hoods.reload} />
        <LeaseForm
          values={values}
          onChange={setValues}
          onSubmit={submit}
          neighbourhoods={neighbourhoods}
          neighbourhoodsLoading={hoods.loading}
          locked={locked}
          busy={busy}
        />

        {busy && (
          <div className="lease-loading" role="status" aria-live="polite">
            <span className="lease-spinner" aria-hidden="true" />
            <span>
              Reading your lease… this can take up to 30 seconds.{' '}
              <span className="muted">{elapsed}s</span>
            </span>
          </div>
        )}

        <ErrorBox error={error} />
        {error?.status === 401 && (
          <p className="small">
            Your session has expired. <LoginButton className="btn btn-sm" />
          </p>
        )}
      </section>

      {result && (
        <section className="card lease-result-card" ref={resultRef} aria-live="polite">
          <h2>Result</h2>
          <AnalysisResult analysis={result} />
        </section>
      )}

      {isAuthenticated && (
        <section className="card">
          <h2>Your past checks</h2>
          <AnalysisHistory
            items={history.data || []}
            loading={history.loading}
            error={history.error}
            onRetry={history.reload}
            selectedId={result?.id}
            openingId={openingId}
            onOpen={openAnalysis}
            disabled={busy || Boolean(openingId)}
          />
        </section>
      )}
    </>
  );
}
