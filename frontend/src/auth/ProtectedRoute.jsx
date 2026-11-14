import useAuth from './useAuth.js';
import LoginButton from './LoginButton.jsx';
import VerifyEmailNotice from './VerifyEmailNotice.jsx';

/** Renders children only for a logged-in user with a verified email (or the dev user). */
export default function ProtectedRoute({ children }) {
  const { isLoading, isAuthenticated, canUse, mode } = useAuth();

  if (isLoading) return <p className="muted">Checking your session…</p>;
  if (canUse) return children;
  if (isAuthenticated) {
    return (
      <section className="card">
        <h2>Verify your email</h2>
        <VerifyEmailNotice action="continue" />
      </section>
    );
  }

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
