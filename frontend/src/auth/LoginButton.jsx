import { useLocation } from 'react-router-dom';
import { useT } from '../strings.js';
import useAuth from './useAuth.js';

export default function LoginButton({ className = 'btn btn-primary', returnTo }) {
  const t = useT();
  const { mode, loginWithRedirect } = useAuth();
  const location = useLocation();

  if (mode !== 'auth0') {
    return (
      <button type="button" className={className} disabled title={t('auth.loginDisabled')}>
        {t('auth.login')}
      </button>
    );
  }

  return (
    <button
      type="button"
      className={className}
      onClick={() =>
        loginWithRedirect({ appState: { returnTo: returnTo || location.pathname + location.search } })
      }
    >
      {t('auth.login')}
    </button>
  );
}
