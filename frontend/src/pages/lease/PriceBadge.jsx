import { VERDICTS, formatEur, formatPct, roomsLabel } from './format.js';

export default function PriceBadge({ verdict, rentEur, rooms, neighbourhood }) {
  const v = VERDICTS[verdict.verdict] || { label: verdict.verdict, tone: 'info' };
  const city = verdict.scope === 'city';

  return (
    <section className={`lease-price lease-tone-${v.tone}`} aria-label="Price check">
      <div className="lease-price-head">
        <span className="small lease-price-kicker">Price check</span>
        <strong className="lease-price-verdict">{v.label}</strong>
      </div>

      <p className="lease-price-line">
        {formatEur(rentEur)} is <strong>{formatPct(verdict.diff_pct)}</strong> vs the median of{' '}
        <strong>{formatEur(verdict.median_eur)}</strong> for {roomsLabel(rooms)}
        {city ? ' across Timișoara' : ` in ${neighbourhood}`}.
      </p>

      {verdict.verdict === 'suspiciously_low' && (
        <p className="lease-price-line">
          Far below the market. Never pay a deposit before you have seen the flat and the
          owner's ID and property papers.
        </p>
      )}

      <ul className="chips">
        <li className="chip">
          {verdict.sample_size} {verdict.sample_size === 1 ? 'listing' : 'listings'}
        </li>
        {city && <li className="chip">City-wide comparison (few listings here)</li>}
      </ul>
      <p className="small lease-price-note">Based on sample listing data.</p>
    </section>
  );
}
