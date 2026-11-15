import { useState } from 'react';
import { createEvent } from '../../api.js';
import ErrorBox from '../../components/ErrorBox.jsx';
import { interestLabel, useT } from './strings.js';

const EMPTY = { title: '', venue: '', starts: '', interest: '', description: '' };

/** "2026-11-15T12:30" for a datetime-local input's min: now, on the browser's clock. */
function localNow() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

/** The form behind "Create an event". Calls onCreated(event) with the saved event. */
export default function CreateEventForm({ interests, onCreated, onCancel }) {
  const t = useT();
  const [values, setValues] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const event = await createEvent({
        title: values.title.trim(),
        venue: values.venue.trim(),
        // The input gives local time without a zone; the API wants a full ISO datetime.
        starts_at: new Date(values.starts).toISOString(),
        interest_slug: values.interest || null,
        description: values.description.trim() || null,
      });
      onCreated(event);
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  const ready = values.title.trim().length >= 3 && values.venue.trim().length >= 2 && values.starts;

  return (
    <form className="form" onSubmit={submit}>
      <p className="muted small">{t('createLead')}</p>
      <label className="field">
        <span className="field-label">{t('eventTitle')}</span>
        <input
          className="input"
          value={values.title}
          onChange={set('title')}
          minLength={3}
          maxLength={100}
          required
          placeholder={t('eventTitlePlaceholder')}
        />
      </label>
      <label className="field">
        <span className="field-label">{t('eventVenue')}</span>
        <input
          className="input"
          value={values.venue}
          onChange={set('venue')}
          minLength={2}
          maxLength={100}
          required
          placeholder={t('eventVenuePlaceholder')}
        />
      </label>
      <div className="filters">
        <label className="field">
          <span className="field-label">{t('eventStarts')}</span>
          <input
            className="input"
            type="datetime-local"
            value={values.starts}
            min={localNow()}
            onChange={set('starts')}
            required
          />
        </label>
        <label className="field">
          <span className="field-label">{t('eventInterest')}</span>
          <select className="input" value={values.interest} onChange={set('interest')}>
            <option value="">{t('eventNoInterest')}</option>
            {interests.map((i) => (
              <option key={i.slug} value={i.slug}>
                {interestLabel(t, i)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="field">
        <span className="field-label">{t('eventDescription')}</span>
        <textarea
          className="input event-textarea"
          rows={3}
          value={values.description}
          onChange={set('description')}
          maxLength={1000}
          placeholder={t('eventDescriptionPlaceholder')}
        />
      </label>

      <ErrorBox error={error} />
      <div className="form-actions">
        <button className="btn btn-primary" disabled={saving || !ready}>
          {saving ? t('publishing') : t('publish')}
        </button>
        <button type="button" className="btn" onClick={onCancel} disabled={saving}>
          {t('cancel')}
        </button>
      </div>
    </form>
  );
}
