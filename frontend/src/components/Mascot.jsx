import { useMemo } from 'react';

// Timi, the mascot: a small house on legs, still looking for its street.
// A user without a profile picture is shown as a Timi of their own. The seed (the user id)
// picks the roof, the legs and two colours, and the same seed always gives the same Timi.
// Nothing is stored and nothing is fetched.

// 7 cells wide. '#' is a filled cell.
const ROOFS = [
  ['...#...', '..###..', '.#####.', '#######'], // gable
  ['...#...', '...#...', '.#####.', '.#####.'], // flat roof with an antenna
  ['...#...', '.#.#.#.', '.#####.', '#######'], // three spires
  ['..###..', '..###..', '.#####.', '#######'], // stepped gable
  ['...#.#.', '..####.', '.#####.', '#######'], // gable with a chimney
  ['..###..', '.#####.', '.#####.', '#######'], // round roof
];
const FACE = '.#.#.#.'; // two windows for eyes: always the same, so every Timi is a Timi
const LEGS = [
  ['.#####.', '.#...#.'], // standing
  ['.#####.', '##...##'], // feet out
  ['.#####.', '.#.#.#.'], // on stilts
  ['.#####.', '.#..#..'], // mid-step
  ['.##.##.', '.#...#.'], // a door, like an open mouth
];
const SIZE = 9; // 7 cells and one cell of room on every side

/** FNV-1a: a string to a 32-bit number. */
function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32: a seeded random number generator, 0 <= n < 1. */
function generator(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rgb(hue, saturation, lightness) {
  const a = saturation * Math.min(lightness, 1 - lightness);
  const channel = (n) => {
    const k = (n + hue / 30) % 12;
    return Math.round(255 * (lightness - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return `rgb(${channel(0)}, ${channel(8)}, ${channel(4)})`;
}

/** One path for all filled cells; each run of cells in a row is one rectangle. */
function pathOf(rows) {
  let d = '';
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x += 1) {
      if (row[x] !== '#') continue;
      let end = x;
      while (row[end + 1] === '#') end += 1;
      d += `M${x + 1} ${y + 1}h${end - x + 1}v1h${x - end - 1}z`;
      x = end;
    }
  });
  return d;
}

/**
 * The Timi for a seed: { d, body, back }.
 * The two colours are random, within limits: a deep body on a pale background of a
 * different hue, so the shape always reads.
 */
export function mascotFor(seed) {
  const random = generator(hash(String(seed || 'timi')));
  const roof = ROOFS[Math.floor(random() * ROOFS.length)];
  const legs = LEGS[Math.floor(random() * LEGS.length)];
  const hue = random() * 360;
  return {
    d: pathOf([...roof, FACE, ...legs]),
    body: rgb(hue, 0.6 + random() * 0.2, 0.34 + random() * 0.1),
    back: rgb((hue + 150 + random() * 60) % 360, 0.7 + random() * 0.25, 0.84 + random() * 0.06),
  };
}

const MARK = pathOf([...ROOFS[0], FACE, ...LEGS[0]]);

/** The default profile picture for `seed`. Decorative: the name next to it says who it is. */
export default function Mascot({ seed, className = '' }) {
  const { d, body, back } = useMemo(() => mascotFor(seed), [seed]);
  return (
    <svg
      className={`mascot ${className}`}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
    >
      <rect width={SIZE} height={SIZE} fill={back} />
      <path d={d} fill={body} />
    </svg>
  );
}

/** Timi in one colour (currentColor), for the logo. */
export function TimiMark({ className = '' }) {
  return (
    <svg
      className={className}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
    >
      <path d={MARK} fill="currentColor" />
    </svg>
  );
}
