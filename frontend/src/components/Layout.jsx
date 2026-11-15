import { Link, NavLink, Outlet, useMatch } from 'react-router-dom';
import { LoginButton, LogoutButton, useAuth } from '../auth/index.js';
import { useProfile } from '../profile/ProfileContext.jsx';
import Avatar from './Avatar.jsx';
import { TimiMark } from './Mascot.jsx';
import ThemeToggle from './ThemeToggle.jsx';

function AuthControls() {
  const { isLoading, isAuthenticated, user, mode } = useAuth();
  const { profile, loading } = useProfile();
  if (isLoading) return <span className="muted small">…</span>;
  if (!isAuthenticated) return <LoginButton className="btn btn-primary btn-sm" />;

  // The picture and first name link to the account page; the email address is never put in
  // the top bar. An account that still has to verify its email has no profile: its Timi
  // comes from the login id instead.
  const name = profile?.display_name || (mode === 'dev' ? user.name : 'Account');
  const seed = profile?.user_id || (loading ? null : user?.sub || user?.name);
  return (
    <>
      <NavLink
        to="/me"
        className={({ isActive }) => (isActive ? 'user-chip active' : 'user-chip')}
        aria-label={`Your account: ${name}`}
      >
        <Avatar userId={seed} src={profile?.avatar_url} size={32} />
        <span className="user-chip-name">{name}</span>
      </NavLink>
      {mode === 'dev' && <span className="badge badge-warn">dev</span>}
      <LogoutButton className="btn btn-sm" />
    </>
  );
}

export default function Layout() {
  const link = ({ isActive }) => (isActive ? 'nav-link active' : 'nav-link');
  const landing = useMatch('/');
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="topbar">
        <div className="container topbar-inner">
          <NavLink to="/" className="brand" aria-label="Timișoara Newcomer Hub, home">
            <TimiMark className="brand-mark" />
            <span>Newcomer Hub</span>
            <span className="brand-city">Timișoara</span>
          </NavLink>
          <nav className="nav" aria-label="Main">
            <NavLink to="/lease" className={link}>
              Lease check
            </NavLink>
            <NavLink to="/events" className={link}>
              Events
            </NavLink>
          </nav>
          <div className="auth">
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
          <p>Timișoara Newcomer Hub. A UniHack project, built in 48 hours.</p>
          <p className="footer-links">
            <Link to="/lease">Lease check</Link>
            <Link to="/events">Events</Link>
            <Link to="/me">Account</Link>
          </p>
        </div>
      </footer>
    </>
  );
}
