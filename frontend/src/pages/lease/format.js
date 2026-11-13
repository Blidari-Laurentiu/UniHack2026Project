// Labels and formatters shared by the lease components (Person A).

export const LIMITS = {
  textMin: 50,
  textMax: 50000,
  roomsMin: 1,
  roomsMax: 3,
  rentMax: 20000,
};

export const VERDICTS = {
  below_market: { label: 'Below market', tone: 'ok' },
  fair: { label: 'Fair price', tone: 'info' },
  above_market: { label: 'Above market', tone: 'warn' },
  suspiciously_low: { label: 'Possibly a scam', tone: 'err' },
};

export const RISKS = {
  low: { label: 'Low risk', tone: 'ok' },
  medium: { label: 'Medium risk', tone: 'warn' },
  high: { label: 'High risk', tone: 'err' },
};

export const SEVERITIES = {
  low: { label: 'Low', tone: 'ok' },
  medium: { label: 'Medium', tone: 'warn' },
  high: { label: 'High', tone: 'err' },
};

const eur = new Intl.NumberFormat('en-IE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

export const formatEur = (n) => eur.format(n);

export function formatPct(n) {
  const rounded = Math.round(n * 10) / 10;
  return `${rounded > 0 ? '+' : ''}${rounded}%`;
}

export function formatDate(iso) {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const roomsLabel = (n) => `${n} ${n === 1 ? 'room' : 'rooms'}`;

/** "deposit" or "rent_increase" -> "Deposit" / "Rent increase" */
export function categoryLabel(c) {
  if (!c) return '';
  const s = c.replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}
