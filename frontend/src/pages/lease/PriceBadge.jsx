import { VERDICT_TONES, formatters } from './format.js';
import { rich } from '../../i18n.jsx';
import { useT } from './strings.js';

export default function PriceBadge({ verdict, rentEur, rooms, neighbourhood }) {
  const t = useT();
  const f = formatters(t.lang);
  const tone = VERDICT_TONES[verdict.verdict] || 'info';
  const label = t.opt(`verdict.${verdict.verdict}`) ?? verdict.verdict;
  const city = verdict.scope === 'city';

  return (
    <section className={`lease-price lease-tone-${tone}`} aria-label={t('price.title')}>
      <div className="lease-price-head">
        <span className="small lease-price-kicker">{t('price.title')}</span>
        <strong className="lease-price-verdict">{label}</strong>
      </div>

      <p className="lease-price-line">
        {rich(
          t(
            'price.line',
            f.eur(rentEur),
            f.pct(verdict.diff_pct),
            f.eur(verdict.median_eur),
            t('rooms', rooms),
            city ? '' : neighbourhood,
          ),
        )}
      </p>

      {verdict.verdict === 'suspiciously_low' && <p className="lease-price-line">{t('price.scam')}</p>}

      <ul className="chips">
        <li className="chip">{t('listings', verdict.sample_size)}</li>
        {city && <li className="chip lease-chip-wrap">{t('price.cityWide')}</li>}
      </ul>
      <p className="small lease-price-note">{t('sampleData')}</p>
    </section>
  );
}
