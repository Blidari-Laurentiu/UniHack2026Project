// Limits, tones and locale-aware formatters shared by the lease components (Person A).
// The words themselves are in strings.js; this file only knows numbers, dates and colours.

export const LIMITS = {
  textMin: 50,
  textMax: 50000,
  roomsMin: 1,
  roomsMax: 3,
  rentMax: 20000,
  pdfMaxBytes: 5 * 1024 * 1024, // same as MAX_BYTES in backend/services/pdf_text.py
};

// Colour tone per value. The label is t(`verdict.${key}`), t(`risk.${key}`) or t(`severity.${key}`).
export const VERDICT_TONES = {
  below_market: 'ok',
  fair: 'info',
  above_market: 'warn',
  suspiciously_low: 'err',
};
export const LEVEL_TONES = { low: 'ok', medium: 'warn', high: 'err' };

const LOCALES = {
  en: { number: 'en-IE', date: 'en-GB', shortMonth: 'en-US', list: 'en-GB' }, // en-US: "Sep", not "Sept"
  ro: { number: 'ro-RO', date: 'ro-RO', shortMonth: 'ro-RO', list: 'ro' },
};

function build(lang) {
  const loc = LOCALES[lang] || LOCALES.en;
  // Romanian: "1.500 €" (the default would be "1.500 EUR", too wide for the chart axis).
  const currency = { style: 'currency', currency: 'EUR', currencyDisplay: 'narrowSymbol' };
  const eur0 = new Intl.NumberFormat(loc.number, { ...currency, maximumFractionDigits: 0 });
  const eur2 = new Intl.NumberFormat(loc.number, currency);
  const int = new Intl.NumberFormat(loc.number, { maximumFractionDigits: 0 });
  const signed = new Intl.NumberFormat(loc.number, { maximumFractionDigits: 1, signDisplay: 'exceptZero' });
  const list = new Intl.ListFormat(loc.list, { type: 'conjunction' });
  const monthDate = (iso) => {
    const [y, m] = iso.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, 1));
  };
  const month = (iso, locale, opts) => monthDate(iso).toLocaleString(locale, { timeZone: 'UTC', ...opts });

  return {
    /** "€1,500" / "1.500 €" */
    eur: (n) => eur0.format(n),
    /** With cents: "€490.00" / "490,00 €" */
    eurExact: (n) => eur2.format(n),
    /** "50,000" / "50.000" */
    int: (n) => int.format(n),
    /** "+2.5%" / "+2,5%" */
    pct: (n) => `${signed.format(n)}%`,
    /** "14 Nov 2026, 17:57" / "14 nov. 2026, 17:57" */
    date: (iso) =>
      new Date(iso).toLocaleString(loc.date, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    /** For a "YYYY-MM-01" month key: "Sep" / "sept." */
    shortMonth: (iso) => month(iso, loc.shortMonth, { month: 'short' }),
    /** "September 2026" / "septembrie 2026" */
    longMonth: (iso) => month(iso, loc.date, { month: 'long', year: 'numeric' }),
    /** "A, B and C" / "A, B și C" */
    list: (names) => list.format(names),
    /** For sorting names with diacritics. */
    compare: (a, b) => a.localeCompare(b, loc.list),
  };
}

const cache = {};
/** Formatters for a language code: const f = formatters(t.lang). */
export const formatters = (lang) => (cache[lang] ||= build(lang));
