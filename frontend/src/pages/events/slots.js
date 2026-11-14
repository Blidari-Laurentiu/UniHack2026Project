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
