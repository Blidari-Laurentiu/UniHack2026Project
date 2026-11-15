import { useState } from 'react';
import { deleteAvatar, uploadAvatar } from '../../api.js';
import ErrorBox from '../../components/ErrorBox.jsx';
import { UploadIcon } from '../../components/Icon.jsx';
import { useProfile } from '../../profile/ProfileContext.jsx';
import { PICTURE_TYPES, squarePicture } from './squarePicture.js';
import { useT } from './strings.js';

/**
 * Add, change or remove the profile picture. Without one the user is shown as their Timi.
 * The new profile goes into the shared profile state, so the top bar updates at once.
 */
export default function AvatarEditor() {
  const t = useT();
  const { profile, setProfile } = useProfile();
  const [busy, setBusy] = useState('');
  const [error, setError] = useState(null);
  const [done, setDone] = useState(''); // a strings.js key, so it follows the language

  if (!profile) return null;
  const hasPicture = Boolean(profile.avatar_url);

  async function run(what, fn, message) {
    if (busy) return;
    setBusy(what);
    setError(null);
    setDone('');
    try {
      setProfile(await fn());
      setDone(message);
    } catch (err) {
      setError(err);
    } finally {
      setBusy('');
    }
  }

  const pick = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // picking the same file again must fire a change too
    if (!file) return;
    run('upload', async () => uploadAvatar(await squarePicture(file)), 'avatar.updated');
  };

  const remove = () => run('remove', deleteAvatar, 'avatar.removed');

  return (
    <div className="avatar-editor">
      <div className="avatar-editor-text">
        <h3 className="field-label" id="avatar-editor-title">
          {t('avatar.title')}
        </h3>
        <p className="muted small">
          {hasPicture ? t('avatar.has') : t('avatar.none')}
        </p>
      </div>
      <div className="form-actions">
        <label className="btn file-btn" aria-disabled={Boolean(busy)}>
          <UploadIcon />
          {busy === 'upload'
            ? t('avatar.uploading')
            : t(hasPicture ? 'avatar.change' : 'avatar.add')}
          <input
            type="file"
            accept={PICTURE_TYPES}
            onChange={pick}
            disabled={Boolean(busy)}
            aria-describedby="avatar-editor-title"
          />
        </label>
        {hasPicture && (
          <button type="button" className="btn" onClick={remove} disabled={Boolean(busy)}>
            {busy === 'remove' ? t('avatar.removing') : t('avatar.remove')}
          </button>
        )}
      </div>
      <p className="sr-only" role="status">
        {done && t(done)}
      </p>
      {/* A picture that could not be prepared here: its text is ours, in the current language. */}
      <ErrorBox
        error={error?.pictureKey ? { message: t(`picture.${error.pictureKey}`) } : error}
      />
    </div>
  );
}
