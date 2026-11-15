import { useEffect } from 'react';
import { Link, NavLink, Outlet, useMatch } from 'react-router-dom';
import { LoginButton, LogoutButton, useAuth } from '../auth/index.js';
import { LangSwitch } from '../i18n.jsx';
import { useProfile } from '../profile/ProfileContext.jsx';
import { useT } from '../strings.js';
import Avatar from './Avatar.jsx';
import { TimiMark } from './Mascot.jsx';
import ThemeToggle from './ThemeToggle.jsx';

function AuthControls() {
  const t = useT();
  const { isLoading, isAuthenticated, user, mode } = useAuth();
  const { profile, loading } = useProfile();
  if (isLoading) return <span className="muted small">…</span>;
  if (!isAuthenticated) return <LoginButton className="btn btn-primary btn-sm" />;

  // The picture and first name link to the account page; the email address is never put in
  // the top bar. An account that still has to verify its email has no profile: its Timi
  // comes from the login id instead.
  const name = profile?.display_name || (mode === 'dev' ? user.name : t('account.fallback'));
  const seed = profile?.user_id || (loading ? null : user?.sub || user?.name);
  return (
    <>
      <NavLink
        to="/me"
        className={({ isActive }) => (isActive ? 'user-chip active' : 'user-chip')}
        aria-label={t('account.label', name)}
      >
        <Avatar userId={seed} src={profile?.avatar_url} size={32} />
        <span className="user-chip-name">{name}</span>
      </NavLink>
      {mode === 'dev' && (
        <span className="badge badge-warn" title={t('auth.dev', user.name)}>
          dev
        </span>
      )}
      <LogoutButton className="btn btn-sm" />
    </>
  );
}

export default function Layout() {
  const t = useT();
  const link = ({ isActive }) => (isActive ? 'nav-link active' : 'nav-link');
  const landing = useMatch('/');

  const title = t('title');
  useEffect(() => {
    document.title = title;
  }, [title]);

  return (
    <>
      <a className="skip-link" href="#main">
        {t('skip')}
      </a>
      <header className="topbar">
        <div className="container topbar-inner">
          <NavLink to="/" className="brand" aria-label={t('brand.home')}>
            <TimiMark className="brand-mark" />
            <span>{t('brand')}</span>
            <span className="brand-city">Timișoara</span>
          </NavLink>
          <nav className="nav" aria-label={t('nav.label')}>
            <NavLink to="/lease" className={link}>
              {t('nav.lease')}
            </NavLink>
            <NavLink to="/events" className={link}>
              {t('nav.events')}
            </NavLink>
          </nav>
          <div className="auth">
            <LangSwitch />
            <ThemeToggle />
            <AuthControls />
          </div>
        </div>
      </header>
      <main id="main" className={landing ? 'main main-flush' : 'container main'}>
        <Outlet />
      </main>
      <footer className="footer">
        <div className="container footer-inner">
          <p>{t('footer.text')}</p>
          <p className="footer-links">
            <Link to="/lease">{t('nav.lease')}</Link>
            <Link to="/events">{t('nav.events')}</Link>
            <Link to="/me">{t('footer.account')}</Link>
          </p>
        </div>
      </footer>
    </>
  );
}
