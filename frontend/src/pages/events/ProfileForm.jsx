import { useState } from 'react';
import { saveProfile } from '../../api.js';
import ErrorBox from '../../components/ErrorBox.jsx';
import { SLOTS } from './slots.js';
import { interestLabel, slotLabel, useT } from './strings.js';

function toggle(list, value) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/** Name, interests and availability. Calls onSaved(profile) after a successful save. */
export default function ProfileForm({ profile, interests, defaultName = '', onSaved, onCancel }) {
  const t = useT();
  const [name, setName] = useState(profile?.display_name || defaultName);
  const [slugs, setSlugs] = useState((profile?.interests || []).map((i) => i.slug));
  const [slots, setSlots] = useState(profile?.availability || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const saved = await saveProfile({
        display_name: name.trim(),
        interest_slugs: slugs,
        availability: slots,
      });
      onSaved(saved);
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      <label className="field">
        <span className="field-label">{t('firstName')}</span>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={64}
          required
          placeholder={t('firstNamePlaceholder')}
        />
      </label>

      <fieldset className="field">
        <legend className="field-label">{t('likes')}</legend>
        <div className="toggles">
          {interests.map((i) => (
            <label key={i.slug} className="toggle">
              <input
                type="checkbox"
                checked={slugs.includes(i.slug)}
                onChange={() => setSlugs((s) => toggle(s, i.slug))}
              />
              <span>{interestLabel(t, i)}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="field">
        <legend className="field-label">{t('free')}</legend>
        <div className="toggles">
          {SLOTS.map((s) => (
            <label key={s} className="toggle">
              <input
                type="checkbox"
                checked={slots.includes(s)}
                onChange={() => setSlots((v) => toggle(v, s))}
              />
              <span>{slotLabel(t, s)}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <ErrorBox error={error} />
      <div className="form-actions">
        <button className="btn btn-primary" disabled={saving || !name.trim()}>
          {saving ? t('saving') : t('saveProfile')}
        </button>
        {onCancel && (
          <button type="button" className="btn" onClick={onCancel} disabled={saving}>
            {t('cancel')}
          </button>
        )}
      </div>
    </form>
  );
}
