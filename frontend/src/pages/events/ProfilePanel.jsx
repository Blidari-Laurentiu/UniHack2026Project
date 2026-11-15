import { useState } from 'react';
import Avatar from '../../components/Avatar.jsx';
import ErrorBox from '../../components/ErrorBox.jsx';
import { useProfile } from '../../profile/ProfileContext.jsx';
import ProfileForm from './ProfileForm.jsx';
import { interestLabel, slotLabel, useT } from './strings.js';

/**
 * The user's profile (name, interests, free time): a summary with an Edit button, or the
 * form. Used on the Events page and on the account page (`account`: that page already shows
 * the name and picture, so the summary starts with a heading instead). onSaved(profile) is
 * optional. The profile itself lives in the shared profile state.
 */
export default function ProfilePanel({ interests, authUser, onSaved, account = false }) {
  const t = useT();
  const { profile: current, loading, error, reload, setProfile } = useProfile();
  const [editing, setEditing] = useState(false);

  if (loading && !current) return <p className="muted">{t('loadingProfile')}</p>;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
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
            setProfile(p);
            setEditing(false);
            onSaved?.(p);
          }}
          onCancel={incomplete ? undefined : () => setEditing(false)}
        />
      </>
    );
  }

  const chips = (
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
  );

  return (
    <div className="profile-summary">
      {account ? (
        <div>
          <h2>{t('interestsTitle')}</h2>
          {chips}
        </div>
      ) : (
        <div className="profile-summary-main">
          <Avatar userId={current.user_id} src={current.avatar_url} size={44} />
          <div>
            <strong className="profile-summary-name">{current.display_name}</strong>{' '}
            {current.is_student && <span className="badge badge-ok">{t('verifiedStudent')}</span>}
            {chips}
          </div>
        </div>
      )}
      <button type="button" className="btn btn-sm" onClick={() => setEditing(true)}>
        {t('editProfile')}
      </button>
    </div>
  );
}
