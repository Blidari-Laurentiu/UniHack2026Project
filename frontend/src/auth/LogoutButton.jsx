import { LogoutIcon } from '../components/Icon.jsx';
import { useT } from '../strings.js';
import useAuth from './useAuth.js';

// iconOnly: a square icon button (the top bar, where the label does not fit in every
// language). The label stays as the accessible name and the tooltip.
export default function LogoutButton({ className = 'btn', iconOnly = false }) {
  const t = useT();
  const { mode, logout } = useAuth();
  if (mode !== 'auth0') return null;

  const label = t('auth.logout');
  return (
    <button
      type="button"
      className={iconOnly ? 'icon-btn' : className}
      aria-label={iconOnly ? label : undefined}
      title={iconOnly ? label : undefined}
      onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
    >
      {iconOnly ? <LogoutIcon /> : label}
    </button>
  );
}
