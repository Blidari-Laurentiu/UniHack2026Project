// Availability slots, in the order used everywhere (same as backend/schemas/common.py).
export const SLOTS = [
  { value: 'weekday_morning', label: 'Weekday mornings' },
  { value: 'weekday_evening', label: 'Weekday evenings' },
  { value: 'weekend_morning', label: 'Weekend mornings' },
  { value: 'weekend_afternoon', label: 'Weekend afternoons' },
  { value: 'weekend_evening', label: 'Weekend evenings' },
];

export const slotLabel = (value) => SLOTS.find((s) => s.value === value)?.label || value;

export function formatWhen(iso) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** { month: 'Nov', day: '18', weekday: 'Wed' } in the browser's language, for the date tile. */
export function dateParts(iso) {
  const date = new Date(iso);
  const part = (options) => date.toLocaleString(undefined, options);
  return {
    month: part({ month: 'short' }),
    day: part({ day: 'numeric' }),
    weekday: part({ weekday: 'short' }),
  };
}

export function formatTime(iso) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}
