// Availability slots, in the order used everywhere (same as backend/schemas/common.py).
// The label of each one is slotLabel(t, slot) from strings.js, in the current language;
// event and meeting times use t.fmt.weekdayTime(iso) from i18n.jsx.
export const SLOTS = [
  'weekday_morning',
  'weekday_evening',
  'weekend_morning',
  'weekend_afternoon',
  'weekend_evening',
];

// Same locales as i18n.jsx: day before month, as in Timișoara.
const LOCALES = { en: 'en-GB', ro: 'ro-RO' };

/** The date tile on an event card: { month: 'Nov', day: '18', weekday: 'Wed' } in `lang`. */
export function dateParts(iso, lang) {
  const date = new Date(iso);
  const part = (options) => date.toLocaleString(LOCALES[lang] || LOCALES.en, options);
  return {
    month: part({ month: 'short' }).replace('.', ''),
    day: part({ day: 'numeric' }),
    weekday: part({ weekday: 'short' }).replace('.', ''),
  };
}
