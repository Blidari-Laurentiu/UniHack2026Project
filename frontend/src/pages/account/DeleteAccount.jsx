import { useState } from 'react';
import { deleteAccount } from '../../api.js';
import { useAuth } from '../../auth/index.js';
import ErrorBox from '../../components/ErrorBox.jsx';
import { rich } from '../../i18n.jsx';
import { useT } from './strings.js';

// ȘTERGE may be typed without the comma (STERGE, or Ş with a cedilla): compare the letters only.
const bare = (text) => text.normalize('NFD').replace(/\p{M}/gu, '').trim().toUpperCase();

/** Delete the account for good. `account` is the useApi state of GET /account. */
export default function DeleteAccount({ account }) {
  const t = useT();
  const { mode, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const word = t('delete.word');
  const confirmed = bare(typed) === bare(word);

  const a = account.data;
  if (!a) return null;

  const submit = async (e) => {
    e.preventDefault();
    if (busy || !confirmed) return;
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
      <h2>{t('delete.title')}</h2>
      {!a.can_delete && <p className="muted">{t('delete.notSetUp')}</p>}
      {a.can_delete && !open && (
        <>
          <p className="muted">{t('delete.what')}</p>
          <div className="form-actions">
            <button type="button" className="btn" onClick={() => setOpen(true)}>
              {t('delete.open')}
            </button>
          </div>
        </>
      )}
      {a.can_delete && open && (
        <form className="form" onSubmit={submit}>
          <p>{rich(t('delete.confirmText'))}</p>
          <label className="field">
            <span className="field-label">{t('delete.typeWord', word)}</span>
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
            <button className="btn btn-danger" disabled={busy || !confirmed}>
              {busy ? t('delete.deleting') : t('delete.submit')}
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
              {t('cancel')}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
