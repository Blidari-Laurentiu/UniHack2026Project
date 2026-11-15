// Event groups, in outline: four people, one of them you (amber), and what they share:
// board games, music and the same free evening. Decorative; the text beside it says the same.

const PEOPLE = [
  { x: 82, up: 0 },
  { x: 136, up: 14 },
  { x: 250, up: 8 },
  { x: 194, up: 2, you: true }, // drawn last: in front
];

function Person({ x, up, you = false }) {
  const shoulders = 212 - up;
  return (
    <g>
      <path
        className={you ? 'art-amber' : 'art-solid'}
        d={`M${x - 29} 236V${shoulders}a29 29 0 0 1 58 0V236`}
      />
      <circle className={you ? 'art-amber' : 'art-solid'} cx={x} cy={shoulders - 40} r="17" />
    </g>
  );
}

export default function GroupArt() {
  return (
    <svg className="art" viewBox="0 0 340 260" aria-hidden="true" focusable="false">
      {/* What they have in common */}
      <path
        className="art-solid"
        d="M82 14H258a14 14 0 0 1 14 14V62a14 14 0 0 1-14 14H186L170 96L160 76H82a14 14 0 0 1-14-14V28a14 14 0 0 1 14-14Z"
      />
      <rect className="art-line art-thin" x="96" y="33" width="24" height="24" rx="5" />
      <circle className="art-ink" cx="102.5" cy="39.5" r="2" />
      <circle className="art-ink" cx="108" cy="45" r="2" />
      <circle className="art-ink" cx="113.5" cy="50.5" r="2" />
      <ellipse className="art-ink" cx="164" cy="55" rx="5.5" ry="4.5" />
      <path className="art-line" d="M169 55V33q9 3 9 12" />
      <circle className="art-line art-thin" cx="232" cy="45" r="12" />
      <path className="art-line art-thin" d="M232 38v7l5 3" />

      {PEOPLE.map((p) => (
        <Person key={p.x} {...p} />
      ))}
      <path className="art-line" d="M28 236H312" />

      {/* Groups are 3 to 5 people */}
      <rect className="art-amber art-thin" x="280" y="120" width="44" height="24" rx="4" />
      <text className="art-text art-on-amber" x="302" y="137" textAnchor="middle" style={{ fontSize: 12 }}>
        3–5
      </text>
    </svg>
  );
}
