// Monthly median rent over the last 12 months, as an inline SVG line chart (Person A).
// No chart library. Data: GET /pricing/trend, which reads the TimescaleDB continuous aggregate.
// The chosen neighbourhood is drawn in blue with the whole city as a dashed grey reference line;
// a neighbourhood with too few months of listings falls back to the city line alone.
import { useEffect, useRef, useState } from 'react';
import { getPriceTrend } from '../../api.js';
import ErrorBox from '../../components/ErrorBox.jsx';
import useApi from '../../useApi.js';
import { formatEur, formatPct, roomsLabel } from './format.js';

const ROOM_OPTIONS = [1, 2, 3];
const MIN_AREA_MONTHS = 6; // fewer months with listings in the neighbourhood -> city line only
const MIN_POINTS = 3; // fewer than this and there is no trend to draw
const HEIGHT = 220;
const roomFlats = (n) => `${n}-room`; // "2-room listings"
const PAD = { top: 14, right: 14, bottom: 26, left: 46 };

const monthDate = (iso) => {
  const [y, m] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1));
};
const fmtMonth = (iso, opts, locale = 'en-GB') =>
  monthDate(iso).toLocaleString(locale, { timeZone: 'UTC', ...opts });
const shortMonth = (iso) => fmtMonth(iso, { month: 'short' }, 'en-US'); // "Sep", not en-GB "Sept"
const longMonth = (iso) => fmtMonth(iso, { month: 'long', year: 'numeric' });
const currentMonth = () => new Date().toISOString().slice(0, 7) + '-01';

/** Twelve month keys ending at the current month, oldest first. */
function monthRange() {
  const now = new Date();
  return Array.from({ length: 12 }, (_, i) =>
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11 + i, 1)).toISOString().slice(0, 10),
  );
}

function niceScale(values) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const step = [10, 25, 50, 100, 250].find((s) => (max - min + 2 * s) / s <= 5) || 500;
  return { lo: Math.floor((min - step / 2) / step) * step, hi: Math.ceil((max + step / 2) / step) * step, step };
}

function useWidth(ref) {
  const [width, setWidth] = useState(600);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}

/**
 * Paths for a series. A month with no listings breaks the line instead of bridging it, and the
 * step into the current month (still filling up, often only a few listings) is drawn apart,
 * dashed, so a thin partial month does not read as a real drop or jump.
 */
function linePaths(series, months, x, y, partialIdx) {
  let solid = '';
  let partial = '';
  let prev = -2;
  months.forEach((m, i) => {
    const p = series.byMonth.get(m);
    if (!p) return;
    const pt = `${x(i).toFixed(1)},${y(p.median_eur).toFixed(1)}`;
    if (i === partialIdx) {
      if (prev === i - 1) {
        const q = series.byMonth.get(months[prev]);
        partial = `M${x(prev).toFixed(1)},${y(q.median_eur).toFixed(1)}L${pt}`;
      }
    } else {
      solid += `${i === prev + 1 ? 'L' : 'M'}${pt}`;
    }
    prev = i;
  });
  return { solid, partial };
}

/** First full month vs the latest full month (the current month is still filling up). */
function change(points) {
  const full = points.filter((p) => p.month !== currentMonth());
  if (full.length < 2) return null;
  const first = full[0];
  const last = full[full.length - 1];
  return { first, last, pct: ((last.median_eur - first.median_eur) / first.median_eur) * 100 };
}

function Plot({ series, months }) {
  const boxRef = useRef(null);
  const width = useWidth(boxRef);
  const [active, setActive] = useState(null);

  const innerW = Math.max(width - PAD.left - PAD.right, 100);
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const { lo, hi, step } = niceScale(series.flatMap((s) => s.points.map((p) => p.median_eur)));
  const colW = innerW / months.length;
  const x = (i) => PAD.left + colW * (i + 0.5);
  const y = (v) => PAD.top + innerH - ((v - lo) / (hi - lo)) * innerH;
  const ticks = [];
  for (let v = lo; v <= hi; v += step) ticks.push(v);
  const labelEvery = colW < 34 ? 2 : 1; // at phone width, every other month
  const thisMonth = currentMonth();
  const partialIdx = months.indexOf(thisMonth);

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const i = Math.floor((e.clientX - rect.left - PAD.left) / colW);
    setActive(i >= 0 && i < months.length ? i : null);
  };

  const tip = active == null ? null : months[active];
  const tipRows = tip ? series.map((s) => ({ s, p: s.byMonth.get(tip) })).filter((r) => r.p) : [];

  return (
    <div className="lease-trend-plot" ref={boxRef}>
      <svg
        width={width}
        height={HEIGHT}
        className="lease-trend-svg"
        aria-hidden="true"
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={(e) => e.pointerType === 'mouse' && setActive(null)}
      >
        {ticks.map((v) => (
          <g key={v}>
            <line className="lease-trend-grid" x1={PAD.left} x2={PAD.left + innerW} y1={y(v)} y2={y(v)} />
            <text className="lease-trend-tick" x={PAD.left - 6} y={y(v)} dy="0.32em" textAnchor="end">
              {formatEur(v)}
            </text>
          </g>
        ))}
        {months.map((m, i) =>
          i % labelEvery === (months.length - 1) % labelEvery ? (
            <text key={m} className="lease-trend-tick" x={x(i)} y={HEIGHT - 8} textAnchor="middle">
              {shortMonth(m)}
            </text>
          ) : null,
        )}
        {partialIdx >= 0 && (
          <rect
            className="lease-trend-partial"
            x={x(partialIdx) - colW / 2}
            y={PAD.top}
            width={colW}
            height={innerH}
          />
        )}
        {tip && <line className="lease-trend-cross" x1={x(active)} x2={x(active)} y1={PAD.top} y2={PAD.top + innerH} />}
        {series.map((s) => {
          const { solid, partial } = linePaths(s, months, x, y, partialIdx);
          return (
          <g key={s.key} className={`lease-trend-series lease-trend-series-${s.kind}`}>
            <path d={solid} className="lease-trend-line" />
            {partial && <path d={partial} className="lease-trend-line lease-trend-line-partial" />}
            {months.map((m, i) => {
              const p = s.byMonth.get(m);
              if (!p) return null;
              const hollow = m === thisMonth; // still filling up
              return (
                <circle
                  key={m}
                  cx={x(i)}
                  cy={y(p.median_eur)}
                  r={active === i ? 5 : 3.5}
                  className={`lease-trend-dot${hollow ? ' lease-trend-dot-partial' : ''}`}
                />
              );
            })}
          </g>
          );
        })}
      </svg>
      {tip && tipRows.length > 0 && (
        <div
          className="lease-trend-tip"
          style={active > months.length / 2 ? { right: width - x(active) + 10 } : { left: x(active) + 10 }}
        >
          <strong>
            {longMonth(tip)}
            {tip === thisMonth && ' (so far)'}
          </strong>
          {tipRows.map(({ s, p }) => (
            <span key={s.key}>
              {s.label}: {formatEur(p.median_eur)} <span className="muted">({p.count})</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * props:
 *   neighbourhoods  names for the select (from GET /pricing/neighbourhoods)
 *   neighbourhood   neighbourhood of the current result
 *   rooms           room count of the current result
 * LeasePage remounts it (key) for each new result, so the controls start from that result.
 */
export default function TrendChart({ neighbourhoods = [], neighbourhood, rooms }) {
  const [hood, setHood] = useState(neighbourhood || '');
  const [shownRooms, setShownRooms] = useState(ROOM_OPTIONS.includes(rooms) ? rooms : 2);

  const trend = useApi(
    () =>
      Promise.all([
        hood ? getPriceTrend({ rooms: shownRooms, neighbourhood: hood }) : Promise.resolve(null),
        getPriceTrend({ rooms: shownRooms }),
      ]),
    [hood, shownRooms],
  );

  const options = [...neighbourhoods];
  if (neighbourhood && !options.includes(neighbourhood)) options.push(neighbourhood);
  options.sort((a, b) => a.localeCompare(b));

  const [area, city] = trend.data || [];
  const areaUsable = Boolean(hood && area && area.length >= MIN_AREA_MONTHS);
  const fellBack = Boolean(hood && area && !areaUsable);
  const toSeries = (key, kind, label, points) => ({
    key, kind, label, points, byMonth: new Map(points.map((p) => [p.month, p])),
  });
  const series = [];
  if (areaUsable) series.push(toSeries('area', 'area', hood, area));
  if (city?.length) series.push(toSeries('city', areaUsable ? 'context' : 'main', 'Whole city', city));
  const main = series[0];
  const enough = main && main.points.length >= MIN_POINTS;
  const months = monthRange();
  const delta = enough ? change(main.points) : null;

  let body;
  if (!trend.data) {
    body = trend.error ? (
      <ErrorBox error={trend.error} onRetry={trend.reload} />
    ) : (
      <p className="muted lease-trend-status" role="status">
        Loading the price trend…
      </p>
    );
  } else if (!enough) {
    body = (
      <p className="muted lease-trend-status">
        Not enough data: fewer than {MIN_POINTS} months have {roomFlats(shownRooms)} listings
        {hood ? ` in ${hood} or the city` : ' in the city'}, so there is no trend to show.
      </p>
    );
  } else {
    const summary =
      `Median monthly rent for ${roomsLabel(shownRooms)}, ${main.label === 'Whole city' ? 'whole city' : main.label}` +
      (delta
        ? `: ${formatEur(delta.first.median_eur)} in ${longMonth(delta.first.month)}, ` +
          `${formatEur(delta.last.median_eur)} in ${longMonth(delta.last.month)} (${formatPct(delta.pct)}).`
        : '.');
    body = (
      <figure className="lease-trend-figure" aria-busy={trend.loading}>
        {fellBack && (
          <p className="small lease-trend-fallback">
            Only {area.length} of the last 12 months have {roomFlats(shownRooms)} listings in {hood}, so this
            shows the whole city instead.
          </p>
        )}
        <figcaption className="lease-trend-summary">
          {delta ? (
            <>
              <strong>{formatEur(delta.last.median_eur)}</strong> in {longMonth(delta.last.month)}, {formatPct(delta.pct)}{' '}
              since {longMonth(delta.first.month)}
              <span className="muted"> · {main.label === 'Whole city' ? 'whole city' : main.label}</span>
            </>
          ) : (
            summary
          )}
        </figcaption>
        {series.length > 1 && (
          <ul className="lease-trend-legend" aria-hidden="true">
            {series.map((s) => (
              <li key={s.key} className={`lease-trend-key lease-trend-key-${s.kind}`}>
                <svg width="22" height="10">
                  <line x1="1" x2="21" y1="5" y2="5" />
                </svg>
                {s.label}
              </li>
            ))}
          </ul>
        )}
        <div className={trend.loading ? 'lease-trend-stale' : undefined}>
          <Plot series={series} months={months} />
        </div>
        <div className="lease-trend-sr">
          <table>
            <caption>{summary} Month by month, oldest first; listing counts in brackets.</caption>
            <thead>
              <tr>
                <th scope="col">Month</th>
                {series.map((s) => (
                  <th key={s.key} scope="col">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {months.map((m) => (
                <tr key={m}>
                  <th scope="row">
                    {longMonth(m)}
                    {m === currentMonth() && ' (so far)'}
                  </th>
                  {series.map((s) => {
                    const p = s.byMonth.get(m);
                    return <td key={s.key}>{p ? `${formatEur(p.median_eur)} (${p.count})` : 'no listings'}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </figure>
    );
  }

  return (
    <div className="lease-trend">
      <div className="lease-trend-toolbar">
        <label className="lease-trend-field">
          <span className="small muted">Area</span>
          <select className="input lease-trend-select" value={hood} onChange={(e) => setHood(e.target.value)}>
            <option value="">Whole city</option>
            {options.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <div className="lease-trend-field">
          <span className="small muted" id="lease-trend-rooms-label">
            Flat size
          </span>
          <div className="lease-chart-toggle" role="group" aria-labelledby="lease-trend-rooms-label">
            {ROOM_OPTIONS.map((n) => (
              <button
                key={n}
                type="button"
                className="lease-chart-toggle-btn"
                aria-pressed={shownRooms === n}
                onClick={() => setShownRooms(n)}
              >
                {roomsLabel(n)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {body}

      <p className="small muted lease-trend-note">
        Based on sample listing data: median asking rent per calendar month, last 12 months. Hollow dots
        and a dashed last step mark the current month, which is still filling up. Hover or tap a month for
        listing counts.
      </p>
    </div>
  );
}
