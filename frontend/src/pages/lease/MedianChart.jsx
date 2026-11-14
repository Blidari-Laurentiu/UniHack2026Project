// Neighbourhood median rent, one horizontal bar per neighbourhood (Person A).
// Plain HTML/CSS bars, no chart library. The data comes from LeasePage (GET /pricing/neighbourhoods).
import { useEffect, useState } from 'react';
import LeaseError from './LeaseError.jsx';
import { formatters } from './format.js';
import { useT } from './strings.js';

const ROOM_OPTIONS = [1, 2, 3];
// A rent far above every median would squash all the bars; past this factor the marker is pinned.
const MAX_SCALE_FACTOR = 1.6;

/**
 * props:
 *   data, loading, error, onRetry  the useApi(getNeighbourhoods) state from LeasePage
 *   rooms          rooms value from the form ('1' | '2' | '3')
 *   neighbourhood  neighbourhood chosen in the form ('' when none)
 *   result         latest analysis shown on the page (or null), for the "your rent" marker
 */
export default function MedianChart({ data, loading, error, onRetry, rooms, neighbourhood, result }) {
  const t = useT();
  const f = formatters(t.lang);
  const [shownRooms, setShownRooms] = useState(Number(rooms) || 2);

  // Follow the form when the user changes rooms there.
  useEffect(() => {
    const n = Number(rooms);
    if (ROOM_OPTIONS.includes(n)) setShownRooms(n);
  }, [rooms]);

  // When a new result is shown, jump to its room count so the marker is visible.
  useEffect(() => {
    if (result && ROOM_OPTIONS.includes(result.rooms)) setShownRooms(result.rooms);
  }, [result]);

  if (!data) {
    if (error) return <LeaseError error={error} onRetry={onRetry} />;
    if (loading) {
      return (
        <p className="muted lease-chart-status" role="status">
          {t('median.loading')}
        </p>
      );
    }
    return null;
  }
  if (data.length === 0) {
    return <p className="muted lease-chart-status">{t('median.empty')}</p>;
  }

  const key = String(shownRooms);
  const roomsText = t('rooms', shownRooms);
  const rows = data
    .filter((n) => n.median_eur_by_rooms?.[key] != null)
    .map((n) => ({ name: n.name, median: n.median_eur_by_rooms[key], sample: n.sample_size }))
    .sort((a, b) => b.median - a.median || f.compare(a.name, b.name));
  const skipped = data
    .filter((n) => n.median_eur_by_rooms?.[key] == null)
    .map((n) => n.name)
    .sort(f.compare);

  const maxMedian = rows.length ? rows[0].median : 0;

  // The rent marker belongs to the analysed flat: its neighbourhood, at its room count.
  const marker =
    result && result.rooms === shownRooms && rows.some((r) => r.name === result.neighbourhood)
      ? { name: result.neighbourhood, rent: result.rent_eur }
      : null;
  let scaleMax = maxMedian;
  if (marker) scaleMax = Math.max(scaleMax, Math.min(marker.rent, maxMedian * MAX_SCALE_FACTOR));
  const pct = (v) => Math.max(0, Math.min(100, (v / scaleMax) * 100));

  return (
    <div className="lease-chart">
      <div className="lease-chart-toolbar">
        <span className="small muted" id="lease-chart-rooms-label">
          {t('flatSize')}
        </span>
        <div className="lease-chart-toggle" role="group" aria-labelledby="lease-chart-rooms-label">
          {ROOM_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              className="lease-chart-toggle-btn"
              aria-pressed={shownRooms === n}
              onClick={() => setShownRooms(n)}
            >
              {t('rooms', n)}
            </button>
          ))}
        </div>
      </div>

      <p className="small muted lease-chart-sub">{t('median.sub', roomsText)}</p>

      {rows.length === 0 ? (
        <p className="muted lease-chart-status">{t('median.none', roomsText)}</p>
      ) : (
        <>
          <ol className="lease-chart-bars" aria-hidden="true">
            {rows.map((r) => {
              const chosen = r.name === neighbourhood;
              const m = marker && marker.name === r.name ? marker : null;
              const mPct = m ? pct(m.rent) : 0;
              const offScale = m && m.rent > scaleMax;
              // A rent above the median puts the marker where the value label would sit, so move
              // the label inside the bar end (only when the bar is long enough to hold it).
              const valueInside = m && m.rent >= r.median && pct(r.median) >= 30;
              return (
                <li
                  key={r.name}
                  className={`lease-chart-row${chosen ? ' lease-chart-row-chosen' : ''}${m ? ' lease-chart-row-marked' : ''}`}
                  title={t('median.rowTitle', r.name, f.eur(r.median), t('listings', r.sample))}
                >
                  <div className="lease-chart-label">
                    <span className="lease-chart-name">
                      {r.name}
                      {chosen && <span className="lease-chart-tag">{t('median.yourArea')}</span>}
                    </span>
                    <span className="lease-chart-n">{t('listings', r.sample)}</span>
                  </div>
                  <div className="lease-chart-track">
                    <div className="lease-chart-scale">
                      <span className="lease-chart-bar" style={{ width: `${pct(r.median)}%` }} />
                      <span
                        className={`lease-chart-value${valueInside ? ' lease-chart-value-inside' : ''}`}
                        style={
                          valueInside ? { right: `${100 - pct(r.median)}%` } : { left: `${pct(r.median)}%` }
                        }
                      >
                        {f.eur(r.median)}
                      </span>
                      {m && <span className="lease-chart-marker" style={{ left: `${mPct}%` }} />}
                    </div>
                    {m && (
                      <div className="lease-chart-scale lease-chart-marker-row">
                        <span
                          className="lease-chart-marker-label"
                          style={mPct > 55 ? { right: `${100 - mPct}%` } : { left: `${mPct}%` }}
                        >
                          {t('median.yourRent', f.eur(m.rent))}
                          {offScale && t('median.offScale')}
                        </span>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>

          {/* Text alternative for the bars. The class sits on a div: tables ignore width/overflow. */}
          <div className="lease-chart-sr">
            <table>
              <caption>{t('median.caption', roomsText)}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('neighbourhood')}</th>
                  <th scope="col">{t('median.colRent')}</th>
                  <th scope="col">{t('median.colListings')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.name}>
                    <th scope="row">
                      {r.name}
                      {r.name === neighbourhood && ` (${t('median.yourArea')})`}
                    </th>
                    <td>
                      {f.eur(r.median)}
                      {marker?.name === r.name && `; ${t('median.yourRent', f.eur(marker.rent))}`}
                    </td>
                    <td>{r.sample}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {skipped.length > 0 && (
        <p className="small muted lease-chart-skipped">{t('median.skipped', roomsText, f.list(skipped))}</p>
      )}
      <p className="small muted lease-chart-note">
        {t('sampleData')} {t('median.note')}
      </p>
    </div>
  );
}
