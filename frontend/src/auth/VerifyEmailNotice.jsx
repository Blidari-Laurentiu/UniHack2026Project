import { useLocation } from 'react-router-dom';
import { rich } from '../i18n.jsx';
import { useT } from '../strings.js';
import useAuth from './useAuth.js';

/**
 * Shown to a logged-in user whose email is not verified yet. Auth0 sends the verification
 * email on sign-up; after clicking the link the user signs in again ("I've verified it"),
 * which runs the Auth0 Actions again and brings back a token with the verified claim.
 * With an Auth0 session still open, that sign-in returns straight away without a prompt.
 *
 * action: what the user wants to do, as a key of 'verify.action.*' in src/strings.js
 * ('continue', 'joinEvents', 'checkLease'). Any other text is shown as it is.
 */
export default function VerifyEmailNotice({ action = 'continue' }) {
  const t = useT();
  const { user, isVerified, loginWithRedirect, logout } = useAuth();
  const location = useLocation();
  const recheck = () =>
    loginWithRedirect?.({ appState: { returnTo: location.pathname + location.search } });
  const doWhat = t.opt(`verify.action.${action}`) ?? action;

  // Verified in Auth0 but the API still has a token from before: just sign in again.
  if (isVerified) {
    return (
      <div className="verify-email" role="status">
        <span>{t('verify.verified')}</span>
        <button type="button" className="btn btn-primary btn-sm" onClick={recheck}>
          {t('verify.signInAgain')}
        </button>
      </div>
    );
  }

  return (
    <div className="verify-email" role="status">
      {user?.email ? (
        <span>
          {rich(t('verify.sent', doWhat, user.email))}{' '}
          <span className="muted">{t('spamHint')}</span>
        </span>
      ) : (
        <span>{t('verify.noEmail', doWhat)}</span>
      )}
      <span className="verify-email-actions">
        {user?.email && (
          <button type="button" className="btn btn-primary btn-sm" onClick={recheck}>
            {t('verify.done')}
          </button>
        )}
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => logout?.({ logoutParams: { returnTo: window.location.origin } })}
        >
          {t('auth.logout')}
        </button>
      </span>
    </div>
  );
}
