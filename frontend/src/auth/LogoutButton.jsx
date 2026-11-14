import { useT } from '../strings.js';
import useAuth from './useAuth.js';

export default function LogoutButton({ className = 'btn' }) {
  const t = useT();
  const { mode, logout } = useAuth();
  if (mode !== 'auth0') return null;

  return (
    <button
      type="button"
      className={className}
      onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
    >
      {t('auth.logout')}
    </button>
  );
}
