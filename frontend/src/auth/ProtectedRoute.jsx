import { rich } from '../i18n.jsx';
import { useT } from '../strings.js';
import useAuth from './useAuth.js';
import LoginButton from './LoginButton.jsx';
import VerifyEmailNotice from './VerifyEmailNotice.jsx';

/** Renders children only for a logged-in user with a verified email (or the dev user). */
export default function ProtectedRoute({ children }) {
  const t = useT();
  const { isLoading, isAuthenticated, canUse, mode } = useAuth();

  if (isLoading) return <p className="muted">{t('auth.checking')}</p>;
  if (canUse) return children;
  if (isAuthenticated) {
    return (
      <section className="card">
        <h2>{t('auth.verifyTitle')}</h2>
        <VerifyEmailNotice action="continue" />
      </section>
    );
  }

  return (
    <section className="card center">
      <h2>{t('auth.loginTitle')}</h2>
      {mode === 'none' ? <p className="muted">{rich(t('auth.notConfigured'))}</p> : <LoginButton />}
    </section>
  );
}
