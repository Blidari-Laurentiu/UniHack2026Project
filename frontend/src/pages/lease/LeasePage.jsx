// Person A owns this folder: lease form, loading state, result (price badge + report) and history.
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { analyzeLease, getAnalysis, getNeighbourhoods, listAnalyses } from '../../api.js';
import { LoginButton, VerifyEmailNotice, useAuth } from '../../auth/index.js';
import useApi from '../../useApi.js';
import AnalysisHistory from './AnalysisHistory.jsx';
import AnalysisResult from './AnalysisResult.jsx';
import LeaseError from './LeaseError.jsx';
import LeaseForm, { EMPTY_FORM } from './LeaseForm.jsx';
import MedianChart from './MedianChart.jsx';
import TrendChart from './TrendChart.jsx';
import { LangScope, LangSwitch } from './i18n.jsx';
import { useT } from './strings.js';

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
  const t = useT();
  const { isAuthenticated, canUse, isLoading: authLoading } = useAuth();

  const hoods = useApi(getNeighbourhoods);
  const neighbourhoods = (hoods.data || []).map((n) => n.name);

  const history = useApi(
    () => (canUse ? listAnalyses() : Promise.resolve([])),
    [canUse],
  );

  // The report language starts as the interface language and follows the EN / RO switch,
  // until the user picks one in the form; after that their choice stays.
  const [values, setValues] = useState(() => ({ ...EMPTY_FORM, ui_language: t.lang }));
  const reportLanguageChosen = useRef(false);
  const changeValues = (next) => {
    if (next.ui_language !== values.ui_language) reportLanguageChosen.current = true;
    setValues(next);
  };
  useEffect(() => {
    if (!reportLanguageChosen.current) setValues((v) => ({ ...v, ui_language: t.lang }));
  }, [t.lang]);

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

  const locked = !canUse;

  return (
    <LangScope>
      <section className="hero">
        <div className="lease-lang-bar">
          <LangSwitch />
        </div>
        <h1>{t('page.title')}</h1>
        <p className="lead">{t('page.lead')}</p>
      </section>

      <section className="card">
        <h2>{t('page.yourLease')}</h2>
        {/* The verify-email notice belongs to the shared auth code and stays in English. */}
        {!authLoading && isAuthenticated && !canUse && (
          <VerifyEmailNotice action="check a lease and keep your past checks" />
        )}
        {!authLoading && !isAuthenticated && (
          <div className="lease-login">
            <span>{t('page.loginPrompt')}</span>
            <LoginButton className="btn btn-primary btn-sm" />
          </div>
        )}

        <LeaseError error={hoods.error} onRetry={hoods.reload} />
        <LeaseForm
          values={values}
          onChange={changeValues}
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
              {t('page.loading')} <span className="muted">{elapsed}s</span>
            </span>
          </div>
        )}

        <LeaseError error={error} />
        {error?.status === 401 && (
          <p className="small">
            {t('page.sessionExpired')} <LoginButton className="btn btn-sm" />
          </p>
        )}
      </section>

      {result && (
        <section className="card lease-result-card" ref={resultRef} aria-live="polite">
          <h2>{t('page.result')}</h2>
          <AnalysisResult analysis={result} />
        </section>
      )}

      {result && (
        <section className="card" aria-labelledby="lease-trend-title">
          <h2 id="lease-trend-title">{t('page.trend')}</h2>
          <TrendChart
            key={result.id}
            neighbourhoods={neighbourhoods}
            neighbourhood={result.neighbourhood}
            rooms={result.rooms}
          />
        </section>
      )}

      <section className="card" aria-labelledby="lease-chart-title">
        <h2 id="lease-chart-title">{t('page.byHood')}</h2>
        <MedianChart
          data={hoods.data}
          loading={hoods.loading}
          error={hoods.error}
          onRetry={hoods.reload}
          rooms={values.rooms}
          neighbourhood={values.neighbourhood}
          result={result}
        />
      </section>

      {canUse && (
        <section className="card">
          <div className="lease-history-page-cardhead">
            <h2>{t('page.pastChecks')}</h2>
            <Link to="/lease/history" className="small">
              {t('page.seeAll')}
            </Link>
          </div>
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
    </LangScope>
  );
}
