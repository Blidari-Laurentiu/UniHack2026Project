import { useRef, useState } from 'react';
import { extractLeaseText } from '../../api.js';
import { LIMITS } from './format.js';
import { errorMessage, useT } from './strings.js';

export const EMPTY_FORM = {
  lease_text: '',
  neighbourhood: '',
  rooms: '2',
  rent_eur: '',
  ui_language: 'en',
};

const PDF_IDLE = { busy: false, error: '', note: '' };

/**
 * Client-side checks with the same limits as LeaseAnalyzeRequest.
 * Returns { field: message }, with the messages from t (useT in strings.js).
 */
export function validate(values, neighbourhoods, t) {
  const errors = {};
  const text = values.lease_text;
  if (text.trim().length < LIMITS.textMin) {
    errors.lease_text = t('error.textShort', LIMITS.textMin);
  } else if (text.length > LIMITS.textMax) {
    errors.lease_text = t('error.textLong', LIMITS.textMax);
  }
  if (!values.neighbourhood) {
    errors.neighbourhood = t('error.hood');
  } else if (neighbourhoods.length && !neighbourhoods.includes(values.neighbourhood)) {
    errors.neighbourhood = t('error.hoodUnknown');
  }
  const rooms = Number(values.rooms);
  if (!Number.isInteger(rooms) || rooms < LIMITS.roomsMin || rooms > LIMITS.roomsMax) {
    errors.rooms = t('error.rooms', LIMITS.roomsMin, LIMITS.roomsMax);
  }
  const rent = Number(values.rent_eur);
  if (values.rent_eur === '' || !Number.isFinite(rent) || rent <= 0) {
    errors.rent_eur = t('error.rent');
  } else if (rent > LIMITS.rentMax) {
    errors.rent_eur = t('error.rentMax', LIMITS.rentMax);
  }
  if (!['en', 'ro'].includes(values.ui_language)) {
    errors.ui_language = t('error.language');
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
  const t = useT();
  const [touched, setTouched] = useState(false);
  const errors = validate(values, neighbourhoods, t);
  const show = (field) => (touched ? errors[field] : undefined);
  const set = (field) => (e) => onChange({ ...values, [field]: e.target.value });

  const disabled = locked || busy;
  const len = values.lease_text.length;
  const tooLong = len > LIMITS.textMax;
  const tooShort = values.lease_text.trim().length < LIMITS.textMin;

  // PDF upload: the server returns the PDF's text, which fills the text box for the user to read.
  // The outcome is kept as data (not as a finished sentence), so it follows a language switch.
  const fileRef = useRef(null);
  const [pdf, setPdf] = useState(PDF_IDLE);
  const latest = useRef(values);
  latest.current = values; // the form may change while the PDF is being read

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // so choosing the same file again still fires a change
    if (!file || pdf.busy) return;
    if (file.size > LIMITS.pdfMaxBytes) {
      setPdf({ ...PDF_IDLE, error: { tooBig: true } });
      return;
    }
    setPdf({ ...PDF_IDLE, busy: true });
    try {
      const out = await extractLeaseText(file);
      onChange({ ...latest.current, lease_text: out.text });
      setPdf({ ...PDF_IDLE, note: { name: file.name, pages: out.pages, characters: out.characters } });
    } catch (err) {
      setPdf({ ...PDF_IDLE, error: err });
    }
  }

  const pdfNote = pdf.note ? t('form.uploadNote', pdf.note.name, pdf.note.pages, pdf.note.characters) : '';
  let pdfError = '';
  if (pdf.error) pdfError = pdf.error.tooBig ? t('form.pdfTooBig') : errorMessage(pdf.error, t, 'pdf');

  function handleSubmit(e) {
    e.preventDefault();
    setTouched(true);
    if (disabled || pdf.busy || Object.keys(errors).length) return;
    onSubmit(toPayload(values));
  }

  return (
    <form className="form lease-form" onSubmit={handleSubmit} noValidate aria-busy={busy}>
      <fieldset className="lease-fieldset" disabled={disabled}>
        <div className="lease-upload">
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,.pdf"
            onChange={handleFile}
            hidden
            tabIndex={-1}
          />
          <div className="lease-upload-row">
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => fileRef.current?.click()}
              disabled={pdf.busy}
            >
              {pdf.busy ? t('form.uploading') : t('form.upload')}
            </button>
            <span className="small muted">{t('form.uploadHint')}</span>
          </div>
          <span className="small lease-upload-note" role="status" aria-live="polite">
            {pdfNote}
          </span>
          {pdfError && (
            <span className="lease-field-error" role="alert">
              {pdfError}
            </span>
          )}
        </div>

        <label className="field">
          <span className="field-label">{t('form.text')}</span>
          <textarea
            className="input lease-textarea"
            value={values.lease_text}
            onChange={set('lease_text')}
            placeholder={t('form.textPlaceholder')}
            rows={10}
            aria-invalid={Boolean(show('lease_text'))}
            aria-describedby="lease-text-count lease-text-error"
          />
          <span
            id="lease-text-count"
            className={`small lease-counter${tooLong || (touched && tooShort) ? ' lease-counter-bad' : ''}`}
          >
            {t('form.counter', len, LIMITS.textMax)}
            {tooShort && t('form.counterMin', LIMITS.textMin)}
          </span>
          <FieldError id="lease-text-error" message={show('lease_text')} />
        </label>

        <div className="lease-grid">
          <label className="field">
            <span className="field-label">{t('neighbourhood')}</span>
            <select
              className="input"
              value={values.neighbourhood}
              onChange={set('neighbourhood')}
              aria-invalid={Boolean(show('neighbourhood'))}
            >
              <option value="">{neighbourhoodsLoading ? t('form.hoodLoading') : t('form.choose')}</option>
              {neighbourhoods.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <FieldError message={show('neighbourhood')} />
          </label>

          <label className="field">
            <span className="field-label">{t('form.rooms')}</span>
            <select
              className="input"
              value={values.rooms}
              onChange={set('rooms')}
              aria-invalid={Boolean(show('rooms'))}
            >
              <option value="1">{t('form.studio')}</option>
              <option value="2">2</option>
              <option value="3">3</option>
            </select>
            <FieldError message={show('rooms')} />
          </label>

          <label className="field">
            <span className="field-label">{t('form.rent')}</span>
            <input
              className="input"
              type="number"
              inputMode="decimal"
              min="1"
              max={LIMITS.rentMax}
              step="any"
              value={values.rent_eur}
              onChange={set('rent_eur')}
              placeholder={t('form.rentPlaceholder')}
              aria-invalid={Boolean(show('rent_eur'))}
            />
            <FieldError message={show('rent_eur')} />
          </label>

          <label className="field">
            <span className="field-label">{t('form.reportLanguage')}</span>
            <select className="input" value={values.ui_language} onChange={set('ui_language')}>
              <option value="en">English</option>
              <option value="ro">Română</option>
            </select>
            <FieldError message={show('ui_language')} />
          </label>
        </div>
      </fieldset>

      <div className="form-actions">
        <button className="btn btn-primary" type="submit" disabled={disabled || pdf.busy}>
          {busy ? t('form.submitting') : t('form.submit')}
        </button>
      </div>
    </form>
  );
}
