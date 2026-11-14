import HowChecked from './HowChecked.jsx';
import LeaseReport from './LeaseReport.jsx';
import PriceBadge from './PriceBadge.jsx';
import { formatters } from './format.js';
import { useT } from './strings.js';

export default function AnalysisResult({ analysis }) {
  const t = useT();
  const f = formatters(t.lang);
  const { report, report_error, price_verdict } = analysis;

  return (
    <div className="lease-result">
      <p className="small muted lease-result-meta">
        {analysis.neighbourhood} · {t('rooms', analysis.rooms)} · {f.eur(analysis.rent_eur)} {t('perMonth')} ·{' '}
        {t('result.checked', f.date(analysis.created_at))}
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
            <strong>{t('result.noReportTitle')}</strong>
            {/* The reason comes from the server, in English. */}
            <p>{report_error || t('result.noReportFallback')}</p>
            <p className="small">{t('result.noReportHint')}</p>
          </div>
        )}
      </div>

      <p className="small lease-disclaimer">
        <strong>{t('result.disclaimerTitle')}</strong> {t('result.disclaimer')}
      </p>

      {/* key: a different analysis starts collapsed and loads its own details */}
      <HowChecked key={analysis.id} analysisId={analysis.id} />
    </div>
  );
}
