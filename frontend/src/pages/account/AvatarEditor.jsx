import { useState } from 'react';
import { deleteAvatar, uploadAvatar } from '../../api.js';
import ErrorBox from '../../components/ErrorBox.jsx';
import { UploadIcon } from '../../components/Icon.jsx';
import { useProfile } from '../../profile/ProfileContext.jsx';
import { PICTURE_TYPES, squarePicture } from './squarePicture.js';

/**
 * Add, change or remove the profile picture. Without one the user is shown as their Timi.
 * The new profile goes into the shared profile state, so the top bar updates at once.
 */
export default function AvatarEditor() {
  const { profile, setProfile } = useProfile();
  const [busy, setBusy] = useState('');
  const [error, setError] = useState(null);
  const [done, setDone] = useState('');

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
    run('upload', async () => uploadAvatar(await squarePicture(file)), 'Picture updated.');
  };

  const remove = () => run('remove', deleteAvatar, 'Picture removed. You are a Timi again.');

  return (
    <div className="avatar-editor">
      <div className="avatar-editor-text">
        <h3 className="field-label" id="avatar-editor-title">
          Profile picture
        </h3>
        <p className="muted small">
          {hasPicture
            ? 'People in your group see this picture next to your name.'
            : 'This is your Timi, the mascot every newcomer starts with. Add a photo and your group sees that instead.'}
        </p>
      </div>
      <div className="form-actions">
        <label className="btn file-btn" aria-disabled={Boolean(busy)}>
          <UploadIcon />
          {busy === 'upload' ? 'Uploading…' : hasPicture ? 'Change picture' : 'Add a picture'}
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
            {busy === 'remove' ? 'Removing…' : 'Remove'}
          </button>
        )}
      </div>
      <p className="sr-only" role="status">
        {done}
      </p>
      <ErrorBox error={error} />
    </div>
  );
}
