import { useLocation } from 'react-router-dom';
import useAuth from './useAuth.js';

export default function LoginButton({ className = 'btn btn-primary', returnTo }) {
  const { mode, loginWithRedirect } = useAuth();
  const location = useLocation();

  if (mode !== 'auth0') {
    return (
      <button className={className} disabled title="Set VITE_AUTH0_DOMAIN and VITE_AUTH0_CLIENT_ID">
        Log in
      </button>
    );
  }

  return (
    <button
      className={className}
      onClick={() =>
        loginWithRedirect({ appState: { returnTo: returnTo || location.pathname + location.search } })
      }
    >
      Log in
    </button>
  );
}
