import LeaseReport from './LeaseReport.jsx';
import PriceBadge from './PriceBadge.jsx';
import { formatDate, formatEur, roomsLabel } from './format.js';

export default function AnalysisResult({ analysis }) {
  const { report, report_error, price_verdict } = analysis;

  return (
    <div className="lease-result">
      <p className="small muted lease-result-meta">
        {analysis.neighbourhood} · {roomsLabel(analysis.rooms)} · {formatEur(analysis.rent_eur)} a
        month · checked {formatDate(analysis.created_at)}
      </p>

      <div className="lease-result-grid">
        <PriceBadge
          verdict={price_verdict}
          rentEur={analysis.rent_eur}
          rooms={analysis.rooms}
          neighbourhood={analysis.neighbourhood}
        />
        {report ? (
          <LeaseReport report={report} />
        ) : (
          <div className="lease-warning" role="status">
            <strong>The clause check did not run this time.</strong>
            <p>{report_error || 'The AI report is unavailable.'}</p>
            <p className="small">The price check still works. Try the clause check again in a minute.</p>
          </div>
        )}
      </div>

      <p className="small lease-disclaimer">
        <strong>Not legal advice.</strong> This is an automatic first check to help you ask the
        right questions. For a binding opinion, ask a lawyer or a notary before you sign.
      </p>
    </div>
  );
}
