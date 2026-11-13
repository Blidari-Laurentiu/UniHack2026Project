import { useAuth0 } from '@auth0/auth0-react';
import { AUTH0_CONFIGURED, DEV_USER } from '../config.js';

/**
 * Auth state for the UI. Same shape whether we use Auth0, the dev header,
 * or nothing is configured yet.
 */
export default function useAuth() {
  const auth0 = useAuth0(); // safe outside the provider: returns default state

  if (DEV_USER) {
    return { mode: 'dev', isLoading: false, isAuthenticated: true, user: { name: DEV_USER } };
  }
  if (!AUTH0_CONFIGURED) {
    return { mode: 'none', isLoading: false, isAuthenticated: false, user: null };
  }
  return {
    mode: 'auth0',
    isLoading: auth0.isLoading,
    isAuthenticated: auth0.isAuthenticated,
    user: auth0.user,
    error: auth0.error,
    loginWithRedirect: auth0.loginWithRedirect,
    logout: auth0.logout,
  };
}
