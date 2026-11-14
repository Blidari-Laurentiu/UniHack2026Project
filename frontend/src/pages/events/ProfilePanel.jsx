import { useState } from 'react';
import { getProfile } from '../../api.js';
import ErrorBox from '../../components/ErrorBox.jsx';
import useApi from '../../useApi.js';
import ProfileForm from './ProfileForm.jsx';
import { interestLabel, slotLabel, useT } from './strings.js';

/**
 * The user's profile (name, interests, free time): a summary with an Edit button, or the
 * form. Used on the Events page and on the account page. onSaved(profile) is optional.
 */
export default function ProfilePanel({ interests, authUser, onSaved }) {
  const t = useT();
  const profile = useApi(getProfile);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(null);
  const current = saved || profile.data;

  if (profile.loading && !current) return <p className="muted">{t('loadingProfile')}</p>;
  if (profile.error) return <ErrorBox error={profile.error} onRetry={profile.reload} />;
  if (!current) return null;

  const incomplete = current.interests.length === 0;
  if (editing || incomplete) {
    return (
      <>
        <h2>{incomplete ? t('tellUs') : t('yourProfile')}</h2>
        {incomplete && <p className="muted">{t('whyAsk')}</p>}
        <ProfileForm
          profile={current}
          interests={interests}
          defaultName={authUser?.given_name || authUser?.nickname || ''}
          onSaved={(p) => {
            setSaved(p);
            setEditing(false);
            onSaved?.(p);
          }}
          onCancel={incomplete ? undefined : () => setEditing(false)}
        />
      </>
    );
  }

  return (
    <div className="profile-summary">
      <div>
        <strong>{current.display_name}</strong>{' '}
        {current.is_student && <span className="badge badge-ok">{t('verifiedStudent')}</span>}
        <ul className="chips">
          {current.interests.map((i) => (
            <li key={i.slug} className="chip">
              {interestLabel(t, i)}
            </li>
          ))}
          {current.availability.map((s) => (
            <li key={s} className="chip chip-soft">
              {slotLabel(t, s)}
            </li>
          ))}
        </ul>
      </div>
      <button type="button" className="btn btn-sm" onClick={() => setEditing(true)}>
        {t('editProfile')}
      </button>
    </div>
  );
}
