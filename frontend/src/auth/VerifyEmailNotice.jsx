import { useLocation } from 'react-router-dom';
import useAuth from './useAuth.js';

/**
 * Shown to a logged-in user whose email is not verified yet. Auth0 sends the verification
 * email on sign-up; after clicking the link the user signs in again ("I've verified it"),
 * which runs the Auth0 Actions again and brings back a token with the verified claim.
 * With an Auth0 session still open, that sign-in returns straight away without a prompt.
 */
export default function VerifyEmailNotice({ action = 'continue' }) {
  const { user, isVerified, loginWithRedirect, logout } = useAuth();
  const location = useLocation();
  const recheck = () =>
    loginWithRedirect?.({ appState: { returnTo: location.pathname + location.search } });

  // Verified in Auth0 but the API still has a token from before: just sign in again.
  if (isVerified) {
    return (
      <div className="verify-email" role="status">
        <span>Your email is verified. Sign in again to refresh your session.</span>
        <button className="btn btn-primary btn-sm" onClick={recheck}>
          Sign in again
        </button>
      </div>
    );
  }

  return (
    <div className="verify-email" role="status">
      {user?.email ? (
        <span>
          Check your email to {action}. We sent a verification link to <b>{user.email}</b>. Open it,
          then come back here. <span className="muted">Not there? Look in your spam folder.</span>
        </span>
      ) : (
        <span>
          Your account has no email address we can verify. Log out and sign in with Google or with
          an email code to {action}.
        </span>
      )}
      <span className="verify-email-actions">
        {user?.email && (
          <button className="btn btn-primary btn-sm" onClick={recheck}>
            I&apos;ve verified it
          </button>
        )}
        <button
          className="btn btn-sm"
          onClick={() => logout?.({ logoutParams: { returnTo: window.location.origin } })}
        >
          Log out
        </button>
      </span>
    </div>
  );
}
