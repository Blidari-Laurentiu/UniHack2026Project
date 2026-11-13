import { RISKS, SEVERITIES, categoryLabel } from './format.js';

export function ToneChip({ map, value, prefix = '' }) {
  const item = map[value] || { label: value, tone: 'info' };
  return (
    <span className={`lease-chip lease-tone-${item.tone}`}>
      {prefix}
      {item.label}
    </span>
  );
}

export default function LeaseReport({ report }) {
  const { summary, overall_risk, risky_clauses = [], missing_clauses = [] } = report;

  return (
    <section className="lease-report" aria-label="Lease report">
      <div className="lease-report-head">
        <h3>Clause check</h3>
        <ToneChip map={RISKS} value={overall_risk} prefix="Overall: " />
      </div>
      <p>{summary}</p>

      <h3>Risky clauses ({risky_clauses.length})</h3>
      {risky_clauses.length === 0 ? (
        <p className="muted">No risky clauses found.</p>
      ) : (
        <ul className="lease-clauses">
          {risky_clauses.map((c, i) => (
            <li key={i} className={`lease-clause lease-edge-${SEVERITIES[c.severity]?.tone || 'info'}`}>
              <div className="lease-clause-head">
                <ToneChip map={SEVERITIES} value={c.severity} prefix="Severity: " />
                {c.category && <span className="chip">{categoryLabel(c.category)}</span>}
              </div>
              <blockquote className="lease-quote">{c.quote}</blockquote>
              <p>
                <strong>Why it matters: </strong>
                {c.why}
              </p>
              <p className="lease-suggestion">
                <strong>What to ask for: </strong>
                {c.suggestion}
              </p>
            </li>
          ))}
        </ul>
      )}

      <h3>Missing clauses ({missing_clauses.length})</h3>
      {missing_clauses.length === 0 ? (
        <p className="muted">Nothing important seems to be missing.</p>
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
