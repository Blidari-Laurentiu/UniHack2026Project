import useAuth from './useAuth.js';

export default function LogoutButton({ className = 'btn' }) {
  const { mode, logout } = useAuth();
  if (mode !== 'auth0') return null;

  return (
    <button
      className={className}
      onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
    >
      Log out
    </button>
  );
}
