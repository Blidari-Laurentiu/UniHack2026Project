import { useState } from 'react';
import { deleteAccount } from '../../api.js';
import { useAuth } from '../../auth/index.js';
import ErrorBox from '../../components/ErrorBox.jsx';

const WORD = 'DELETE';

/** Delete the account for good. `account` is the useApi state of GET /account. */
export default function DeleteAccount({ account }) {
  const { mode, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const a = account.data;
  if (!a) return null;

  const submit = async (e) => {
    e.preventDefault();
    if (busy || typed !== WORD) return;
    setBusy(true);
    setError(null);
    try {
      await deleteAccount();
    } catch (err) {
      setError(err);
      setBusy(false);
      return;
    }
    // The account is gone: end the session. Any request with the old token would make a
    // new, empty account, so leave straight away.
    if (mode === 'auth0') logout?.({ logoutParams: { returnTo: window.location.origin } });
    else window.location.assign('/');
  };

  return (
    <section className="card">
      <h2>Delete account</h2>
      {!a.can_delete && (
        <p className="muted">Deleting accounts is not set up on this server yet.</p>
      )}
      {a.can_delete && !open && (
        <>
          <p className="muted">
            Deletes your profile, your saved lease checks, your event signups and groups, your
            student verification and your login. This cannot be undone.
          </p>
          <div className="form-actions">
            <button className="btn" onClick={() => setOpen(true)}>
              Delete my account
            </button>
          </div>
        </>
      )}
      {a.can_delete && open && (
        <form className="form" onSubmit={submit}>
          <p>
            This deletes your profile, your saved lease checks, your event signups and groups, your
            student verification and your login. <b>It cannot be undone.</b>
          </p>
          <label className="field">
            <span className="field-label">Type {WORD} to confirm</span>
            <input
              className="input"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              disabled={busy}
            />
          </label>
          <ErrorBox error={error} />
          <div className="form-actions">
            <button className="btn btn-primary" disabled={busy || typed !== WORD}>
              {busy ? 'Deleting…' : 'Delete my account for good'}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setOpen(false);
                setTyped('');
                setError(null);
              }}
              disabled={busy}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
