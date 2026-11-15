import { useState } from 'react';
import { requestPasswordReset, turnOffMfa } from '../../api.js';
import { useAuth } from '../../auth/index.js';
import ErrorBox from '../../components/ErrorBox.jsx';
import { rich } from '../../i18n.jsx';
import { useT } from './strings.js';

/**
 * Password and two-factor authentication (2FA) on the account page.
 * `account` is the useApi state of GET /account.
 */
export default function SecurityCard({ account }) {
  const t = useT();
  const { loginWithRedirect } = useAuth();
  const [busy, setBusy] = useState('');
  const [passwordError, setPasswordError] = useState(null);
  const [mfaError, setMfaError] = useState(null);
  const [sentTo, setSentTo] = useState('');

  const a = account.data;
  const mfa = a?.mfa;

  const sendPasswordLink = async () => {
    setBusy('password');
    setPasswordError(null);
    try {
      setSentTo((await requestPasswordReset()).sent_to);
    } catch (err) {
      setPasswordError(err);
    } finally {
      setBusy('');
    }
  };

  // Turning 2FA on happens at Auth0: log in again with enroll_mfa=true and the Post-Login
  // Action shows the QR code. The user comes back here with 2FA on.
  const turnOn = () =>
    loginWithRedirect?.({
      authorizationParams: { enroll_mfa: 'true' },
      appState: { returnTo: '/me' },
    });

  // The API only turns 2FA off for a login that used the code (403 otherwise).
  const signInWithCode = () => loginWithRedirect?.({ appState: { returnTo: '/me' } });

  const turnOff = async () => {
    if (!window.confirm(t('mfa.confirmOff'))) return;
    setBusy('mfa');
    setMfaError(null);
    try {
      await turnOffMfa();
      account.reload();
    } catch (err) {
      setMfaError(err);
    } finally {
      setBusy('');
    }
  };

  return (
    <section className="card">
      <h2>{t('security.title')}</h2>
      {account.loading && !a && <p className="muted">{t('loading')}</p>}
      <ErrorBox error={account.error} onRetry={account.reload} />

      {a && (
        <>
          <h3>{t('password.title')}</h3>
          {a.can_change_password ? (
            <>
              {sentTo ? (
                <p role="status">
                  {rich(t('password.sent', sentTo))}{' '}
                  <span className="muted">{t('spamHint')}</span>
                </p>
              ) : (
                <p className="muted">{t('password.how')}</p>
              )}
              <ErrorBox error={passwordError} />
              <div className="form-actions">
                <button className="btn" onClick={sendPasswordLink} disabled={busy === 'password'}>
                  {busy === 'password'
                    ? t('password.sending')
                    : sentTo
                      ? t('password.again')
                      : t('password.change')}
                </button>
              </div>
            </>
          ) : (
            <p className="muted">
              {t('password.none', t.opt(`signIn.${a.login_method}`) ?? t('signIn.other'))}
            </p>
          )}

          <h3>
            {t('mfa.title')}{' '}
            {mfa.enabled === true && <span className="badge badge-ok">{t('mfa.on')}</span>}
            {mfa.enabled === false && <span className="badge badge-warn">{t('mfa.off')}</span>}
          </h3>
          {!mfa.available && (
            <p className="muted">{t('mfa.unavailable')}</p>
          )}
          {mfa.available && mfa.enabled === null && (
            <div className="form-actions">
              <span className="muted">{t('mfa.unknown')}</span>
              <button type="button" className="btn btn-sm" onClick={account.reload}>
                {t('retry')}
              </button>
            </div>
          )}
          {mfa.available && mfa.enabled === false && (
            <>
              <p className="muted">
                {t('mfa.offText')}
                {mfa.required && t('mfa.adminMustHave')}
              </p>
              <div className="form-actions">
                <button type="button" className="btn btn-primary" onClick={turnOn}>
                  {t('mfa.turnOn')}
                </button>
              </div>
            </>
          )}
          {mfa.available && mfa.enabled === true && (
            <>
              <p className="muted">
                {t('mfa.onText')}
                {mfa.required && t('mfa.adminMustKeep')}
              </p>
              <ErrorBox error={mfaError} />
              <div className="form-actions">
                {mfaError?.status === 403 && (
                  <button className="btn btn-primary" onClick={signInWithCode}>
                    {t('mfa.signInWithCode')}
                  </button>
                )}
                {!mfa.required && (
                  <button className="btn" onClick={turnOff} disabled={busy === 'mfa'}>
                    {busy === 'mfa' ? t('mfa.turningOff') : t('mfa.turnOff')}
                  </button>
                )}
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
