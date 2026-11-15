// The landing page drawing: a street in Timișoara, in outline. Cathedral spires, a row of old
// houses, a tram, a street lamp, and Timi arriving with a suitcase.
// It draws itself once on load (styles.css, .art-draw); `d` is each part's delay in ms.
// By night (dark theme) some windows are lit, and the sun gives way to the moon and stars.

const draw = (d = 0) => ({ pathLength: 1, style: { '--d': d } });

function Win({ x, y, lit = false, d }) {
  return (
    <rect
      className={`art-solid art-thin art-window${lit ? ' art-window-lit' : ''}`}
      x={x}
      y={y}
      width="16"
      height="22"
      {...draw(d)}
    />
  );
}

export default function CityArt() {
  return (
    <svg
      className="art art-draw"
      viewBox="0 0 600 420"
      role="img"
      aria-label="Line drawing of a street in Timișoara: cathedral spires, a row of old houses, a tram and a street lamp. Timi, a small house on legs, has just arrived with a suitcase."
    >
      <defs>
        <radialGradient id="city-art-glow">
          <stop offset="0" stopColor="var(--accent)" stopOpacity="0.55" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Sky */}
      <g className="art-day">
        <circle className="art-amber" cx="486" cy="78" r="30" {...draw(900)} />
      </g>
      <g className="art-night">
        <path
          className="art-amber"
          d="M483.5 48.1A30 30 0 1 0 513.1 90.8A26 26 0 0 1 483.5 48.1Z"
          {...draw(900)}
        />
        <path
          className="art-line art-thin"
          d="M176 52v10M171 57h10M330 34v8M326 38h8M412 96v8M408 100h8M246 108v6M243 111h6M96 30v6M93 33h6"
          {...draw(1100)}
        />
      </g>
      <g className="art-far">
        <path
          className="art-line art-thin"
          d="M316 118h56a11 11 0 0 0 0-22a16 16 0 0 0-30-8a13 13 0 0 0-24 8a11 11 0 0 0-2 22z"
          {...draw(1000)}
        />
        <path
          className="art-line art-thin art-day"
          d="M186 86h34a8 8 0 0 0 0-16a12 12 0 0 0-22-5a9 9 0 0 0-14 6a8 8 0 0 0 2 15z"
          {...draw(1100)}
        />
        <path
          className="art-line art-thin art-day"
          d="M224 126q6-8 12 0q6-8 12 0M264 110q5-7 10 0q5-7 10 0"
          {...draw(1200)}
        />
      </g>

      {/* Cathedral: side towers first, the middle one in front of them */}
      <g>
        <path className="art-solid" d="M44 226H70V336H44Z" {...draw(0)} />
        <path className="art-solid" d="M40 226L57 168L74 226Z" {...draw(60)} />
        <path className="art-line" d="M57 168v-9" {...draw(60)} />
        <path className="art-solid" d="M110 226H136V336H110Z" {...draw(0)} />
        <path className="art-solid" d="M106 226L123 168L140 226Z" {...draw(60)} />
        <path className="art-line" d="M123 168v-9" {...draw(60)} />
        <path className="art-solid art-thin art-window" d="M53 264v-14a4 4 0 0 1 8 0v14z" {...draw(500)} />
        <path
          className="art-solid art-thin art-window art-window-lit"
          d="M119 264v-14a4 4 0 0 1 8 0v14z"
          {...draw(500)}
        />
        <path className="art-solid" d="M70 150H110V336H70Z" {...draw(120)} />
        <path className="art-solid" d="M64 150L90 62L116 150Z" {...draw(200)} />
        <path className="art-line" d="M90 62V50" {...draw(200)} />
        <circle className="art-amber art-thin" cx="90" cy="46" r="3.5" {...draw(300)} />
        <path className="art-line art-thin" d="M73 128l8.5-12l8.5 12l8.5-12l8.5 12" {...draw(400)} />
        <path
          className="art-solid art-thin art-window art-window-lit"
          d="M84 216v-28a6 6 0 0 1 12 0v28z"
          {...draw(500)}
        />
        <path className="art-solid art-thin" d="M80 336v-30a10 10 0 0 1 20 0v30" {...draw(500)} />
      </g>

      {/* Houses, left to right */}
      <g>
        <path
          className="art-solid"
          d="M160 336V232Q160 208 178 208Q178 188 196 188Q214 188 214 208Q232 208 232 232V336Z"
          {...draw(250)}
        />
        <path className="art-line art-thin" d="M160 232H232" {...draw(450)} />
        <ellipse className="art-solid art-thin art-window" cx="196" cy="214" rx="7" ry="5" {...draw(650)} />
        <Win x={171} y={246} d={650} />
        <Win x={205} y={246} lit d={700} />
        <Win x={171} y={290} d={750} />
        <path className="art-solid art-thin" d="M203 336v-34a9 9 0 0 1 18 0v34" {...draw(750)} />

        <path className="art-solid" d="M232 336V196L266 158L300 196V336Z" {...draw(350)} />
        <path className="art-line art-thin" d="M232 196H300" {...draw(550)} />
        <circle className="art-solid art-thin art-window" cx="266" cy="181" r="6" {...draw(700)} />
        <Win x={243} y={210} lit d={700} />
        <Win x={273} y={210} d={750} />
        <Win x={243} y={252} d={800} />
        <Win x={273} y={252} lit d={850} />
        <path className="art-solid art-thin" d="M257 336v-36a9 9 0 0 1 18 0v36" {...draw(850)} />

        <path className="art-solid" d="M300 336V238L312 210H376L388 238V336Z" {...draw(450)} />
        <path className="art-line art-thin" d="M300 238H388" {...draw(650)} />
        <rect className="art-solid art-thin art-window" x="322" y="218" width="12" height="12" {...draw(800)} />
        <rect
          className="art-solid art-thin art-window art-window-lit"
          x="354"
          y="218"
          width="12"
          height="12"
          {...draw(800)}
        />
        <Win x={311} y={250} d={800} />
        <Win x={336} y={250} lit d={850} />
        <Win x={361} y={250} d={900} />
        <path
          className="art-solid art-thin"
          d="M310 336v-26a13 13 0 0 1 26 0v26M352 336v-26a13 13 0 0 1 26 0v26"
          {...draw(900)}
        />

        <path
          className="art-solid"
          d="M388 336V216H400V200H412V184H426V200H438V216H450V336Z"
          {...draw(550)}
        />
        <Win x={399} y={230} d={900} />
        <Win x={423} y={230} d={950} />
        <Win x={399} y={272} lit d={950} />
        <Win x={423} y={272} d={1000} />
        <path className="art-solid art-thin" d="M410 336v-32a9 9 0 0 1 18 0v32" {...draw(1000)} />
      </g>

      {/* Pavement and rails */}
      <path className="art-line" d="M14 336H586" {...draw(100)} />
      <path className="art-line art-thin art-far" d="M0 402H600M0 409H600" {...draw(300)} />

      {/* Tram: wheels first, the body hides their upper half */}
      <g>
        <circle className="art-solid art-thin" cx="206" cy="396" r="6" {...draw(700)} />
        <circle className="art-solid art-thin" cx="326" cy="396" r="6" {...draw(700)} />
        <rect className="art-solid" x="176" y="356" width="180" height="38" rx="9" {...draw(700)} />
        <path className="art-line art-thin" d="M256 356l10-10l10 10M259 346h14" {...draw(900)} />
        <path
          className="art-solid art-thin art-window art-window-lit"
          d="M186 363h21v14h-21zM213 363h21v14h-21zM240 363h21v14h-21zM267 363h21v14h-21zM294 363h21v14h-21zM321 363h21v14h-21z"
          {...draw(1000)}
        />
        <path className="art-line art-thin" d="M181 384H351" {...draw(1000)} />
        <circle className="art-amber art-thin" cx="348" cy="389" r="2.5" {...draw(1100)} />
      </g>

      {/* Timi, just arrived, suitcase in hand */}
      <g>
        <path className="art-amber" d="M473 287L480 287L480 294L487 294L487 301L494 301L494 308L501 308L501 315L494 315L494 336L487 336L487 329L466 329L466 336L459 336L459 315L452 315L452 308L459 308L459 301L466 301L466 294L473 294Z" {...draw(1200)} />
        <path className="art-solid art-thin" d="M466 315h7v7h-7zM480 315h7v7h-7z" {...draw(1300)} />
        <path className="art-solid art-thin" d="M506 322h13v14h-13zM510 322v-5h5v5" {...draw(1300)} />
      </g>

      {/* Street lamp. The glow comes on last. */}
      <g>
        <circle className="art-glow art-on" cx="540" cy="196" r="84" fill="url(#city-art-glow)" />
        <path className="art-line" d="M540 336V206" {...draw(600)} />
        <path className="art-solid" d="M532 336v-14h16v14" {...draw(600)} />
        <path
          className="art-line"
          d="M540 238C540 216 516 224 516 208M540 238C540 216 564 224 564 208M510 208h12M558 208h12M534 206h12"
          {...draw(800)}
        />
        <circle className="art-amber" cx="516" cy="198" r="10" {...draw(1000)} />
        <circle className="art-amber" cx="564" cy="198" r="10" {...draw(1000)} />
        <circle className="art-amber" cx="540" cy="194" r="12" {...draw(1000)} />
        <path className="art-solid art-thin" d="M458 246h74v22h-74zM532 257h8" {...draw(1100)} />
        <text className="art-text art-on" x="495" y="261" textAnchor="middle">
          BUN VENIT
        </text>
      </g>
    </svg>
  );
}
