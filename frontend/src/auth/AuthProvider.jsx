import { Auth0Provider, useAuth0 } from '@auth0/auth0-react';
import { useNavigate } from 'react-router-dom';
import { setTokenGetter } from '../api.js';
import { AUTH0_AUDIENCE, AUTH0_CLIENT_ID, AUTH0_CONFIGURED, AUTH0_DOMAIN } from '../config.js';

// Hands getAccessTokenSilently to api.js so apiFetch can add the Bearer token.
// Set during render (not in an effect): child effects run before parent effects,
// so a page's first request would otherwise go out without a token.
function TokenBridge({ children }) {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();
  setTokenGetter(isAuthenticated ? () => getAccessTokenSilently() : null);
  return children;
}

/** Auth0Provider wrapper. Must be rendered inside <BrowserRouter>. */
export default function AuthProvider({ children }) {
  const navigate = useNavigate();

  if (!AUTH0_CONFIGURED) {
    // No Auth0 env yet: app still renders; use VITE_DEV_USER against a dev backend.
    return children;
  }

  return (
    <Auth0Provider
      domain={AUTH0_DOMAIN}
      clientId={AUTH0_CLIENT_ID}
      authorizationParams={{
        redirect_uri: window.location.origin,
        ...(AUTH0_AUDIENCE ? { audience: AUTH0_AUDIENCE } : {}),
      }}
      // Survive page reloads without third-party cookies.
      cacheLocation="localstorage"
      onRedirectCallback={(appState) => navigate(appState?.returnTo || '/', { replace: true })}
    >
      <TokenBridge>{children}</TokenBridge>
    </Auth0Provider>
  );
}
