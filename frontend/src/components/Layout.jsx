import { useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { LoginButton, LogoutButton, useAuth } from '../auth/index.js';
import { LangSwitch } from '../i18n.jsx';
import { useT } from '../strings.js';

function AuthControls() {
  const t = useT();
  const { isLoading, isAuthenticated, user, mode } = useAuth();
  if (isLoading) return <span className="muted small">…</span>;
  if (mode === 'dev') return <span className="badge badge-warn">{t('auth.dev', user.name)}</span>;
  if (!isAuthenticated) return <LoginButton className="btn btn-primary btn-sm" />;
  return (
    <>
      <span className="small nav-user">{user?.name || user?.email}</span>
      <LogoutButton className="btn btn-sm" />
    </>
  );
}

export default function Layout() {
  const t = useT();
  const link = ({ isActive }) => (isActive ? 'nav-link active' : 'nav-link');

  const title = t('title');
  useEffect(() => {
    document.title = title;
  }, [title]);

  return (
    <>
      <header className="topbar">
        <div className="container topbar-inner">
          <NavLink to="/" className="brand">
            {t('brand')} <span className="brand-city">Timișoara</span>
          </NavLink>
          <nav className="nav" aria-label={t('nav.label')}>
            <NavLink to="/lease" className={link}>{t('nav.lease')}</NavLink>
            <NavLink to="/events" className={link}>{t('nav.events')}</NavLink>
            <NavLink to="/me" className={link}>{t('nav.me')}</NavLink>
          </nav>
          <div className="auth">
            <LangSwitch />
            <AuthControls />
          </div>
        </div>
      </header>
      <main className="container main">
        <Outlet />
      </main>
    </>
  );
}
