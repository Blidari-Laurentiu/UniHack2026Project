// Person A: "How this was checked", a collapsible panel under a lease result for the pitch.
// Three tabs: the redacted text Gemini received, Gemini's raw JSON, and the SQL behind the
// price verdict and the trend chart. Details are loaded the first time the panel opens.
import { useEffect, useId, useRef, useState } from 'react';
import { getAnalysisDetails } from '../../api.js';
import LeaseError from './LeaseError.jsx';
import { formatters } from './format.js';
import { AGGREGATE_SQL, MEDIAN_SQL, TREND_SQL } from './howSql.js';
import { rich } from '../../i18n.jsx';
import { useT } from './strings.js';

const REDACTED = '[REDACTED]';
const MARKS = { mark: 'lease-how-redacted' };

const TABS = [
  { id: 'sent', label: 'how.tabSent' },
  { id: 'answer', label: 'how.tabAnswer' },
  { id: 'sql', label: 'how.tabSql' },
];

/** SQL string literal, for showing a parameter value next to the query. */
const sqlString = (s) => `'${String(s).replace(/'/g, "''")}'`;

/** label: 'how.copyJson' or 'how.copyQuery' */
function CopyButton({ text, label }) {
  const t = useT();
  const [status, setStatus] = useState(''); // '', 'how.copied' or 'how.copyFailed'
  useEffect(() => {
    if (!status) return undefined;
    const timer = setTimeout(() => setStatus(''), 2500);
    return () => clearTimeout(timer);
  }, [status]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setStatus('how.copied');
    } catch {
      setStatus('how.copyFailed');
    }
  }

  return (
    <span className="lease-how-copy">
      <button type="button" className="btn btn-sm" onClick={copy}>
        {t(label)}
      </button>
      <span className="small muted" role="status" aria-live="polite">
        {status && t(status)}
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
  const t = useT();
  const n = details.redaction_count;
  return (
    <>
      <p>
        {rich(t('how.sentIntro'))} {n > 0 ? rich(t('how.sentRedacted', n), MARKS) : t('how.sentNone')}{' '}
        {t('how.sentSaved')}
      </p>
      {details.lease_text_redacted ? (
        <CodeBlock label={t('how.sentAria')} className="lease-how-text">
          {withRedactionsMarked(details.lease_text_redacted)}
        </CodeBlock>
      ) : (
        <p className="muted">{t('how.sentNoText')}</p>
      )}
    </>
  );
}

function AnswerPanel({ details }) {
  const t = useT();
  if (!details.gemini_json) {
    return (
      <div className="lease-warning" role="status">
        <strong>{t('how.answerMissing')}</strong>
        {/* The reason comes from the server, in English. */}
        <p>{details.report_error || t('how.answerMissingFallback')}</p>
        <p className="small">{t('how.answerMissingHint')}</p>
      </div>
    );
  }
  const json = JSON.stringify(details.gemini_json, null, 2);
  return (
    <>
      <div className="lease-how-bar">
        <p>{rich(t('how.answerIntro'))}</p>
        <CopyButton text={json} label="how.copyJson" />
      </div>
      <CodeBlock label={t('how.answerAria')}>{highlightJson(json)}</CodeBlock>
    </>
  );
}

function SqlPanel({ details }) {
  const t = useT();
  const f = formatters(t.lang);
  const p = details.price_inputs;
  const verdict = t.opt(`verdict.${p.verdict}`) ?? p.verdict;
  const city = p.scope === 'city';
  const months = parseInt(p.window, 10) || 12; // the API sends "12 months"
  const parameters = (
    <p className="small muted">
      {t('how.parameters')}
      <code>neighbourhood = {sqlString(p.neighbourhood)}</code>, <code>rooms = {p.rooms}</code>
    </p>
  );
  return (
    <>
      <h4 className="lease-how-subhead">{t('how.sqlVerdictTitle')}</h4>
      <p>{t('how.sqlVerdict', months, p.min_sample)}</p>
      <div className="lease-how-bar">
        {parameters}
        <CopyButton text={MEDIAN_SQL} label="how.copyQuery" />
      </div>
      <CodeBlock label={t('how.medianAria')}>{MEDIAN_SQL}</CodeBlock>

      <dl className="kv lease-how-kv">
        <dt>{t('how.comparedWith')}</dt>
        <dd>
          {t('how.comparedValue', t('listings', p.sample_size), t('rooms', p.rooms), city ? '' : p.neighbourhood)}
        </dd>
        <dt>{t('how.median')}</dt>
        <dd>{f.eurExact(p.median_eur)}</dd>
        <dt>{t('how.yourRent')}</dt>
        <dd>
          {f.eurExact(p.rent_eur)} ({f.pct(p.diff_pct)})
        </dd>
        <dt>{t('how.verdict')}</dt>
        <dd>{verdict}</dd>
      </dl>

      <h4 className="lease-how-subhead">{t('how.sqlTrendTitle')}</h4>
      <p>{rich(t('how.sqlTrend'))}</p>
      <div className="lease-how-bar">
        {parameters}
        <CopyButton text={TREND_SQL} label="how.copyQuery" />
      </div>
      <CodeBlock label={t('how.trendAria')}>{TREND_SQL}</CodeBlock>

      <details className="lease-how-more">
        <summary>{t('how.aggregateSummary')}</summary>
        <CodeBlock label={t('how.aggregateAria')}>{AGGREGATE_SQL}</CodeBlock>
      </details>
    </>
  );
}

const PANELS = { sent: SentPanel, answer: AnswerPanel, sql: SqlPanel };

function Tabs({ details }) {
  const t = useT();
  const base = useId();
  const [active, setActive] = useState('sent');
  const tabRefs = useRef({});

  function onKeyDown(e) {
    const i = TABS.findIndex((tab) => tab.id === active);
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
      <div className="lease-how-tabs" role="tablist" aria-label={t('how.title')} onKeyDown={onKeyDown}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            ref={(el) => {
              tabRefs.current[tab.id] = el;
            }}
            type="button"
            role="tab"
            id={`${base}-tab-${tab.id}`}
            aria-selected={active === tab.id}
            aria-controls={`${base}-panel`}
            tabIndex={active === tab.id ? 0 : -1}
            className="lease-how-tab"
            onClick={() => setActive(tab.id)}
          >
            {t(tab.label)}
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
  const t = useT();
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
            {t('how.title')}
            <span className="lease-how-hint small muted">{t('how.hint')}</span>
          </span>
        </button>
      </h3>

      <div id={contentId} className="lease-how-body" hidden={!open}>
        {state.loading && (
          <p className="muted" role="status">
            {t('how.loading')}
          </p>
        )}
        <LeaseError error={state.error} onRetry={() => setTick((n) => n + 1)} />
        {state.data && <Tabs details={state.data} />}
      </div>
    </section>
  );
}
