import { useState } from 'react';
import { LIMITS } from './format.js';

export const EMPTY_FORM = {
  lease_text: '',
  neighbourhood: '',
  rooms: '2',
  rent_eur: '',
  ui_language: 'en',
};

/** Client-side checks with the same limits as LeaseAnalyzeRequest. Returns { field: message }. */
export function validate(values, neighbourhoods) {
  const errors = {};
  const text = values.lease_text;
  if (text.trim().length < LIMITS.textMin) {
    errors.lease_text = `Paste the lease: at least ${LIMITS.textMin} characters.`;
  } else if (text.length > LIMITS.textMax) {
    errors.lease_text = `The lease is too long: at most ${LIMITS.textMax.toLocaleString('en')} characters.`;
  }
  if (!values.neighbourhood) {
    errors.neighbourhood = 'Choose a neighbourhood.';
  } else if (neighbourhoods.length && !neighbourhoods.includes(values.neighbourhood)) {
    errors.neighbourhood = 'Choose a neighbourhood from the list.';
  }
  const rooms = Number(values.rooms);
  if (!Number.isInteger(rooms) || rooms < LIMITS.roomsMin || rooms > LIMITS.roomsMax) {
    errors.rooms = `Rooms must be ${LIMITS.roomsMin} to ${LIMITS.roomsMax}.`;
  }
  const rent = Number(values.rent_eur);
  if (values.rent_eur === '' || !Number.isFinite(rent) || rent <= 0) {
    errors.rent_eur = 'Enter the monthly rent in EUR (more than 0).';
  } else if (rent > LIMITS.rentMax) {
    errors.rent_eur = `Rent must be at most ${LIMITS.rentMax.toLocaleString('en')} EUR.`;
  }
  if (!['en', 'ro'].includes(values.ui_language)) {
    errors.ui_language = 'Choose English or Romanian.';
  }
  return errors;
}

export function toPayload(values) {
  return {
    lease_text: values.lease_text,
    neighbourhood: values.neighbourhood,
    rooms: Number(values.rooms),
    rent_eur: Number(values.rent_eur),
    ui_language: values.ui_language,
  };
}

function FieldError({ id, message }) {
  if (!message) return null;
  return (
    <span id={id} className="lease-field-error">
      {message}
    </span>
  );
}

export default function LeaseForm({
  values,
  onChange,
  onSubmit,
  neighbourhoods,
  neighbourhoodsLoading,
  locked,
  busy,
}) {
  const [touched, setTouched] = useState(false);
  const errors = validate(values, neighbourhoods);
  const show = (field) => (touched ? errors[field] : undefined);
  const set = (field) => (e) => onChange({ ...values, [field]: e.target.value });

  const disabled = locked || busy;
  const len = values.lease_text.length;
  const tooLong = len > LIMITS.textMax;
  const tooShort = values.lease_text.trim().length < LIMITS.textMin;

  function handleSubmit(e) {
    e.preventDefault();
    setTouched(true);
    if (disabled || Object.keys(errors).length) return;
    onSubmit(toPayload(values));
  }

  return (
    <form className="form lease-form" onSubmit={handleSubmit} noValidate aria-busy={busy}>
      <fieldset className="lease-fieldset" disabled={disabled}>
        <label className="field">
          <span className="field-label">Lease text (Romanian or English)</span>
          <textarea
            className="input lease-textarea"
            value={values.lease_text}
            onChange={set('lease_text')}
            placeholder="CONTRACT DE ÎNCHIRIERE…  Paste the whole lease here."
            rows={10}
            aria-invalid={Boolean(show('lease_text'))}
            aria-describedby="lease-text-count lease-text-error"
          />
          <span
            id="lease-text-count"
            className={`small lease-counter${tooLong || (touched && tooShort) ? ' lease-counter-bad' : ''}`}
          >
            {len.toLocaleString('en')} / {LIMITS.textMax.toLocaleString('en')} characters
            {tooShort && ` (at least ${LIMITS.textMin})`}
          </span>
          <FieldError id="lease-text-error" message={show('lease_text')} />
        </label>

        <div className="lease-grid">
          <label className="field">
            <span className="field-label">Neighbourhood</span>
            <select
              className="input"
              value={values.neighbourhood}
              onChange={set('neighbourhood')}
              aria-invalid={Boolean(show('neighbourhood'))}
            >
              <option value="">{neighbourhoodsLoading ? 'Loading…' : 'Choose…'}</option>
              {neighbourhoods.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <FieldError message={show('neighbourhood')} />
          </label>

          <label className="field">
            <span className="field-label">Rooms (camere), living room included</span>
            <select
              className="input"
              value={values.rooms}
              onChange={set('rooms')}
              aria-invalid={Boolean(show('rooms'))}
            >
              <option value="1">1 (studio)</option>
              <option value="2">2</option>
              <option value="3">3</option>
            </select>
            <FieldError message={show('rooms')} />
          </label>

          <label className="field">
            <span className="field-label">Monthly rent (EUR)</span>
            <input
              className="input"
              type="number"
              inputMode="decimal"
              min="1"
              max={LIMITS.rentMax}
              step="any"
              value={values.rent_eur}
              onChange={set('rent_eur')}
              placeholder="e.g. 450"
              aria-invalid={Boolean(show('rent_eur'))}
            />
            <FieldError message={show('rent_eur')} />
          </label>

          <label className="field">
            <span className="field-label">Report language</span>
            <select className="input" value={values.ui_language} onChange={set('ui_language')}>
              <option value="en">English</option>
              <option value="ro">Română</option>
            </select>
            <FieldError message={show('ui_language')} />
          </label>
        </div>
      </fieldset>

      <div className="form-actions">
        <button className="btn btn-primary" type="submit" disabled={disabled}>
          {busy ? 'Checking…' : 'Check my lease'}
        </button>
      </div>
    </form>
  );
}
