// Person A: "How this was checked", a collapsible panel under a lease result for the pitch.
// Three tabs: the redacted text Gemini received, Gemini's raw JSON, and the SQL behind the
// price verdict and the trend chart. Details are loaded the first time the panel opens.
import { useEffect, useId, useRef, useState } from 'react';
import { getAnalysisDetails } from '../../api.js';
import ErrorBox from '../../components/ErrorBox.jsx';
import { VERDICTS, formatPct, roomsLabel } from './format.js';
import { AGGREGATE_SQL, MEDIAN_SQL, TREND_SQL } from './howSql.js';

const REDACTED = '[REDACTED]';

const TABS = [
  { id: 'sent', label: 'Sent to Gemini' },
  { id: 'answer', label: "Gemini's raw answer" },
  { id: 'sql', label: 'The SQL' },
];

const eur2 = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' });

/** SQL string literal, for showing a parameter value next to the query. */
const sqlString = (s) => `'${String(s).replace(/'/g, "''")}'`;

function CopyButton({ text, what }) {
  const [status, setStatus] = useState('');
  useEffect(() => {
    if (!status) return undefined;
    const timer = setTimeout(() => setStatus(''), 2500);
    return () => clearTimeout(timer);
  }, [status]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setStatus('Copied');
    } catch {
      setStatus('Could not copy. Select the text instead.');
    }
  }

  return (
    <span className="lease-how-copy">
      <button type="button" className="btn btn-sm" onClick={copy}>
        Copy {what}
      </button>
      <span className="small muted" role="status" aria-live="polite">
        {status}
      </span>
    </span>
  );
}

/** A focusable, labelled scroll box, so keyboard users can scroll long code. */
function CodeBlock({ label, className = '', children }) {
  return (
    <div className="lease-how-scroll" role="region" aria-label={label} tabIndex={0}>
      <pre className={`lease-how-code ${className}`}>{children}</pre>
    </div>
  );
}

function withRedactionsMarked(text) {
  const parts = text.split(REDACTED);
  return parts.flatMap((part, i) =>
    i === 0
      ? [part]
      : [
          <mark key={i} className="lease-how-redacted">
            {REDACTED}
          </mark>,
          part,
        ],
  );
}

/** Pretty JSON as React spans (keys, strings, numbers, literals); never raw HTML. */
function highlightJson(json) {
  const token = /("(?:\\.|[^"\\])*")(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;
  const out = [];
  let last = 0;
  let match;
  while ((match = token.exec(json))) {
    if (match.index > last) out.push(json.slice(last, match.index));
    const [whole, string, colon] = match;
    let kind = 'number';
    if (string) kind = colon ? 'key' : 'string';
    else if (/^[tfn]/.test(whole)) kind = 'literal';
    out.push(
      <span key={match.index} className={`lease-how-json-${kind}`}>
        {string ?? whole}
      </span>,
    );
    if (colon) out.push(colon);
    last = token.lastIndex;
  }
  out.push(json.slice(last));
  return out;
}

function SentPanel({ details }) {
  const n = details.redaction_count;
  return (
    <>
      <p>
        Gemini received only this text, with our checklist prompt and the <code>LeaseReport</code>{' '}
        JSON schema.{' '}
        {n > 0 ? (
          <>
            Our server replaced <strong>{n}</strong> personal {n === 1 ? 'ID' : 'IDs'} (CNP, IBAN,
            ID card or passport numbers) with <mark className="lease-how-redacted">{REDACTED}</mark>{' '}
            before the request.
          </>
        ) : (
          'No CNP, IBAN, ID card or passport number was found in this lease.'
        )}{' '}
        Only this redacted copy is saved.
      </p>
      {details.lease_text_redacted ? (
        <CodeBlock label="Lease text sent to Gemini" className="lease-how-text">
          {withRedactionsMarked(details.lease_text_redacted)}
        </CodeBlock>
      ) : (
        <p className="muted">No lease text was saved with this check.</p>
      )}
    </>
  );
}

function AnswerPanel({ details }) {
  if (!details.gemini_json) {
    return (
      <div className="lease-warning" role="status">
        <strong>Gemini did not return a report for this check.</strong>
        <p>{details.report_error || 'No report was saved.'}</p>
        <p className="small">
          The price verdict did not need it: it comes straight from the database (see “The SQL”).
        </p>
      </div>
    );
  }
  const json = JSON.stringify(details.gemini_json, null, 2);
  return (
    <>
      <div className="lease-how-bar">
        <p>
          Gemini answered in JSON (<code>response_mime_type: application/json</code> with the{' '}
          <code>LeaseReport</code> schema). We validate it with Pydantic, retry once if it is invalid,
          and render the report above from exactly this.
        </p>
        <CopyButton text={json} what="JSON" />
      </div>
      <CodeBlock label="Gemini's JSON answer">{highlightJson(json)}</CodeBlock>
    </>
  );
}

function SqlPanel({ details }) {
  const p = details.price_inputs;
  const verdict = VERDICTS[p.verdict]?.label || p.verdict;
  const city = p.scope === 'city';
  return (
    <>
      <h4 className="lease-how-subhead">1. Price verdict: one query on the listings hypertable</h4>
      <p>
        The neighbourhood and the city-wide median for the same room count, over the last{' '}
        {p.window}, in one round trip. Fair is within ±10% of the median; more than 30% below is
        flagged as a possible scam. Under {p.min_sample} listings in the neighbourhood, the
        city-wide median is used.
      </p>
      <div className="lease-how-bar">
        <p className="small muted">
          Parameters: <code>neighbourhood = {sqlString(p.neighbourhood)}</code>,{' '}
          <code>rooms = {p.rooms}</code>
        </p>
        <CopyButton text={MEDIAN_SQL} what="query" />
      </div>
      <CodeBlock label="Median query">{MEDIAN_SQL}</CodeBlock>

      <dl className="kv lease-how-kv">
        <dt>Compared with</dt>
        <dd>
          {p.sample_size} {p.sample_size === 1 ? 'listing' : 'listings'} with {roomsLabel(p.rooms)}
          {city ? ' across Timișoara (too few in the neighbourhood)' : ` in ${p.neighbourhood}`}
        </dd>
        <dt>Median</dt>
        <dd>{eur2.format(p.median_eur)}</dd>
        <dt>Your rent</dt>
        <dd>
          {eur2.format(p.rent_eur)} ({formatPct(p.diff_pct)})
        </dd>
        <dt>Verdict</dt>
        <dd>{verdict}</dd>
      </dl>

      <h4 className="lease-how-subhead">2. Price trend: a TimescaleDB continuous aggregate</h4>
      <p>
        The trend chart reads monthly medians from <code>listings_monthly</code>, which TimescaleDB
        keeps up to date: a policy re-materializes it every hour, and the current month is computed
        live from new listings (real-time aggregation).
      </p>
      <div className="lease-how-bar">
        <p className="small muted">
          Parameters: <code>neighbourhood = {sqlString(p.neighbourhood)}</code>,{' '}
          <code>rooms = {p.rooms}</code>
        </p>
        <CopyButton text={TREND_SQL} what="query" />
      </div>
      <CodeBlock label="Trend query">{TREND_SQL}</CodeBlock>

      <details className="lease-how-more">
        <summary>How listings_monthly is defined</summary>
        <CodeBlock label="Continuous aggregate definition">{AGGREGATE_SQL}</CodeBlock>
      </details>
    </>
  );
}

const PANELS = { sent: SentPanel, answer: AnswerPanel, sql: SqlPanel };

function Tabs({ details }) {
  const base = useId();
  const [active, setActive] = useState('sent');
  const tabRefs = useRef({});

  function onKeyDown(e) {
    const i = TABS.findIndex((t) => t.id === active);
    const next = {
      ArrowRight: (i + 1) % TABS.length,
      ArrowLeft: (i - 1 + TABS.length) % TABS.length,
      Home: 0,
      End: TABS.length - 1,
    }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    setActive(TABS[next].id);
    tabRefs.current[TABS[next].id]?.focus();
  }

  const Panel = PANELS[active];
  return (
    <>
      <div className="lease-how-tabs" role="tablist" aria-label="How this was checked" onKeyDown={onKeyDown}>
        {TABS.map((t) => (
          <button
            key={t.id}
            ref={(el) => {
              tabRefs.current[t.id] = el;
            }}
            type="button"
            role="tab"
            id={`${base}-tab-${t.id}`}
            aria-selected={active === t.id}
            aria-controls={`${base}-panel`}
            tabIndex={active === t.id ? 0 : -1}
            className="lease-how-tab"
            onClick={() => setActive(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div
        className="lease-how-panel"
        role="tabpanel"
        id={`${base}-panel`}
        aria-labelledby={`${base}-tab-${active}`}
      >
        <Panel details={details} />
      </div>
    </>
  );
}

export default function HowChecked({ analysisId }) {
  const contentId = useId();
  const [open, setOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const [state, setState] = useState({ data: null, error: null, loading: false });
  const loaded = state.data !== null;

  useEffect(() => {
    if (!open || loaded) return undefined;
    let cancelled = false;
    setState({ data: null, error: null, loading: true });
    getAnalysisDetails(analysisId)
      .then((data) => !cancelled && setState({ data, error: null, loading: false }))
      .catch((error) => !cancelled && setState({ data: null, error, loading: false }));
    return () => {
      cancelled = true;
    };
  }, [open, loaded, analysisId, tick]);

  return (
    <section className="lease-how">
      <h3 className="lease-how-heading">
        <button
          type="button"
          className="lease-how-toggle"
          aria-expanded={open}
          aria-controls={contentId}
          onClick={() => setOpen((o) => !o)}
        >
          <span className="lease-how-chevron" aria-hidden="true" />
          <span>
            How this was checked
            <span className="lease-how-hint small muted">
              What Gemini saw, what it answered, and the SQL behind the price
            </span>
          </span>
        </button>
      </h3>

      <div id={contentId} className="lease-how-body" hidden={!open}>
        {state.loading && (
          <p className="muted" role="status">
            Loading the details…
          </p>
        )}
        <ErrorBox error={state.error} onRetry={() => setTick((t) => t + 1)} />
        {state.data && <Tabs details={state.data} />}
      </div>
    </section>
  );
}
