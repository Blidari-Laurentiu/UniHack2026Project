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
