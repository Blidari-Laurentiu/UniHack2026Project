import { useAuth0 } from '@auth0/auth0-react';
import { AUTH0_CONFIGURED, DEV_USER } from '../config.js';

/**
 * Auth state for the UI. Same shape whether we use Auth0, the dev header,
 * or nothing is configured yet.
 *
 * isVerified: the email is verified (always true for the dev user).
 * canUse: logged in AND verified. Gate every logged-in feature on this, not on
 * isAuthenticated; the backend refuses unverified accounts with 403 anyway.
 */
export default function useAuth() {
  const auth0 = useAuth0(); // safe outside the provider: returns default state

  if (DEV_USER) {
    return {
      mode: 'dev',
      isLoading: false,
      isAuthenticated: true,
      isVerified: true,
      canUse: true,
      user: { name: DEV_USER },
    };
  }
  if (!AUTH0_CONFIGURED) {
    return {
      mode: 'none',
      isLoading: false,
      isAuthenticated: false,
      isVerified: false,
      canUse: false,
      user: null,
    };
  }
  // email_verified comes from the ID token (Auth0's own flag, not our custom claim).
  const isVerified = auth0.isAuthenticated && auth0.user?.email_verified === true;
  return {
    mode: 'auth0',
    isLoading: auth0.isLoading,
    isAuthenticated: auth0.isAuthenticated,
    isVerified,
    canUse: isVerified,
    user: auth0.user,
    error: auth0.error,
    loginWithRedirect: auth0.loginWithRedirect,
    logout: auth0.logout,
  };
}
