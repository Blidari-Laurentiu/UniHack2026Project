import useAuth from './useAuth.js';
import LoginButton from './LoginButton.jsx';

/** Renders children only for a logged-in user (or the dev user). */
export default function ProtectedRoute({ children }) {
  const { isLoading, isAuthenticated, mode } = useAuth();

  if (isLoading) return <p className="muted">Checking your session…</p>;
  if (isAuthenticated) return children;

  return (
    <section className="card center">
      <h2>Log in to continue</h2>
      {mode === 'none' ? (
        <p className="muted">
          Auth0 is not configured. Fill in <code>frontend/.env</code>, or set{' '}
          <code>VITE_DEV_USER</code> to use the dev bypass.
        </p>
      ) : (
        <LoginButton />
      )}
    </section>
  );
}
