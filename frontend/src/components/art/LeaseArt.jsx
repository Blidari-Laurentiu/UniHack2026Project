// Lease check, in outline: a contract with one clause marked, a magnifier that found the
// problem, and a price tag. Decorative; the text beside it says the same.

export default function LeaseArt() {
  return (
    <svg className="art" viewBox="0 0 340 260" aria-hidden="true" focusable="false">
      <defs>
        <clipPath id="lease-art-lens">
          <circle cx="238" cy="168" r="39" />
        </clipPath>
      </defs>

      {/* The contract */}
      <g transform="rotate(-5 150 130)">
        <rect className="art-solid" x="66" y="20" width="172" height="220" rx="8" />
        <path className="art-line" strokeWidth="4" d="M90 50h64" />
        <path className="art-line art-thin" d="M90 74h124M90 90h110" />
        {/* The risky clause */}
        <rect className="art-amber" x="82" y="103" width="140" height="32" rx="4" />
        <path className="art-line art-thin art-on-amber" d="M92 114h118M92 125h84" />
        <path className="art-amber" d="M54 104v38M54 106h22l-6 8l6 8H54" />
        <path className="art-line art-thin" d="M90 152h124M90 168h100M90 184h118" />
        <path className="art-line art-thin" d="M92 216q7-14 13-2t13 0t13-2t11 3" />
        <path className="art-line art-thin art-far" d="M90 224h76" />
      </g>

      {/* The magnifier, and what it found */}
      <path className="art-line" strokeWidth="8" d="M267 197l32 34" />
      <circle className="art-solid" cx="238" cy="168" r="40" />
      <g clipPath="url(#lease-art-lens)">
        <path className="art-line art-thin art-far" d="M196 138h84M196 200h84" />
      </g>
      <path className="art-amber" d="M238 146l24 40h-48z" />
      <path className="art-line art-on-amber" d="M238 160v12" />
      <circle className="art-ink art-on-amber" cx="238" cy="179" r="1.8" />

      {/* The price tag */}
      <g transform="rotate(-10 52 204)">
        <path className="art-solid" d="M16 184h46l18 20l-18 20H16z" />
        <circle className="art-line art-thin" cx="64" cy="204" r="3.5" />
        <text className="art-text" x="36" y="211.5" textAnchor="middle" style={{ fontSize: 21 }}>
          €
        </text>
      </g>
    </svg>
  );
}
