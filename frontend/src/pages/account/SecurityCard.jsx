import { useState } from 'react';
import { requestPasswordReset, turnOffMfa } from '../../api.js';
import { useAuth } from '../../auth/index.js';
import ErrorBox from '../../components/ErrorBox.jsx';

const SIGN_IN_WITH = {
  google: 'Google',
  github: 'GitHub',
  email_code: 'a code sent to your email',
  dev: 'the dev user',
  other: 'another provider',
};

/**
 * Password and two-factor authentication (2FA) on the account page.
 * `account` is the useApi state of GET /account.
 */
export default function SecurityCard({ account }) {
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
    if (
      !window.confirm(
        'Turn off two-factor authentication? Logging in will no longer ask for a code.',
      )
    )
      return;
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
      <h2>Security</h2>
      {account.loading && !a && <p className="muted">Loading…</p>}
      <ErrorBox error={account.error} onRetry={account.reload} />

      {a && (
        <>
          <h3>Password</h3>
          {a.can_change_password ? (
            <>
              {sentTo ? (
                <p role="status">
                  We sent a link to <b>{sentTo}</b>. Open it to choose a new password.{' '}
                  <span className="muted">Not there? Look in your spam folder.</span>
                </p>
              ) : (
                <p className="muted">
                  We email you a link to choose a new password. Your current password keeps working
                  until you use it.
                </p>
              )}
              <ErrorBox error={passwordError} />
              <div className="form-actions">
                <button className="btn" onClick={sendPasswordLink} disabled={busy === 'password'}>
                  {busy === 'password'
                    ? 'Sending…'
                    : sentTo
                      ? 'Send the link again'
                      : 'Change password'}
                </button>
              </div>
            </>
          ) : (
            <p className="muted">
              This account has no password: you sign in with{' '}
              {SIGN_IN_WITH[a.login_method] || 'another provider'}.
            </p>
          )}

          <h3>
            Two-factor authentication{' '}
            {mfa.enabled === true && <span className="badge badge-ok">On</span>}
            {mfa.enabled === false && <span className="badge badge-warn">Off</span>}
          </h3>
          {!mfa.available && (
            <p className="muted">
              Two-factor authentication cannot be managed for this account here.
            </p>
          )}
          {mfa.available && mfa.enabled === null && (
            <div className="form-actions">
              <span className="muted">We could not check it right now.</span>
              <button className="btn btn-sm" onClick={account.reload}>
                Retry
              </button>
            </div>
          )}
          {mfa.available && mfa.enabled === false && (
            <>
              <p className="muted">
                Add an authenticator app (Google Authenticator, Authy). After that, logging in asks
                for a 6-digit code from the app.
                {mfa.required && ' Admin accounts must have it on.'}
              </p>
              <div className="form-actions">
                <button className="btn btn-primary" onClick={turnOn}>
                  Turn on
                </button>
              </div>
            </>
          )}
          {mfa.available && mfa.enabled === true && (
            <>
              <p className="muted">
                Logging in asks for a 6-digit code from your authenticator app.
                {mfa.required && ' Admin accounts must keep it on.'}
              </p>
              <ErrorBox error={mfaError} />
              <div className="form-actions">
                {mfaError?.status === 403 && (
                  <button className="btn btn-primary" onClick={signInWithCode}>
                    Sign in with my code
                  </button>
                )}
                {!mfa.required && (
                  <button className="btn" onClick={turnOff} disabled={busy === 'mfa'}>
                    {busy === 'mfa' ? 'Turning off…' : 'Turn off'}
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
