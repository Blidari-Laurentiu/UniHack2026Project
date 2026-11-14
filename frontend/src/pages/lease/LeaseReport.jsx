import { LEVEL_TONES, VERDICT_TONES } from './format.js';
import { useT } from './strings.js';

const TONES = { verdict: VERDICT_TONES, risk: LEVEL_TONES, severity: LEVEL_TONES };

/** A coloured chip for a price verdict, an overall risk or a clause severity. */
export function ToneChip({ kind, value, wrap }) {
  const t = useT();
  const label = t.opt(`${kind}.${value}`) ?? value;
  return <span className={`lease-chip lease-tone-${TONES[kind]?.[value] || 'info'}`}>{wrap ? wrap(label) : label}</span>;
}

/** "rent_increase" -> "Rent increase", for a category Gemini made up that has no translation. */
function plainCategory(c) {
  const s = c.replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function LeaseReport({ report }) {
  const t = useT();
  const { summary, overall_risk, risky_clauses = [], missing_clauses = [] } = report;

  // Gemini wrote summary, why, suggestion and name in the report language chosen for this check;
  // they are shown as saved, whatever the interface language is now.
  return (
    <section className="lease-report" aria-label={t('report.aria')}>
      <div className="lease-report-head">
        <h3>{t('report.title')}</h3>
        <ToneChip kind="risk" value={overall_risk} wrap={(label) => t('report.overall', label)} />
      </div>
      <p>{summary}</p>

      <h3>{t('report.risky', risky_clauses.length)}</h3>
      {risky_clauses.length === 0 ? (
        <p className="muted">{t('report.riskyNone')}</p>
      ) : (
        <ul className="lease-clauses">
          {risky_clauses.map((c, i) => (
            <li key={i} className={`lease-clause lease-edge-${LEVEL_TONES[c.severity] || 'info'}`}>
              <div className="lease-clause-head">
                <ToneChip kind="severity" value={c.severity} />
                {c.category && (
                  <span className="chip">{t.opt(`category.${c.category}`) ?? plainCategory(c.category)}</span>
                )}
              </div>
              <blockquote className="lease-quote">{c.quote}</blockquote>
              <p>
                <strong>{t('report.why')}</strong>
                {c.why}
              </p>
              <p className="lease-suggestion">
                <strong>{t('report.ask')}</strong>
                {c.suggestion}
              </p>
            </li>
          ))}
        </ul>
      )}

      <h3>{t('report.missing', missing_clauses.length)}</h3>
      {missing_clauses.length === 0 ? (
        <p className="muted">{t('report.missingNone')}</p>
      ) : (
        <ul className="lease-missing">
          {missing_clauses.map((m, i) => (
            <li key={i}>
              <strong>{m.name}</strong>
              <span className="muted"> — {m.why}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
