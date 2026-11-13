import { NavLink, Outlet } from 'react-router-dom';
import { LoginButton, LogoutButton, useAuth } from '../auth/index.js';

function AuthControls() {
  const { isLoading, isAuthenticated, user, mode } = useAuth();
  if (isLoading) return <span className="muted small">…</span>;
  if (mode === 'dev') return <span className="badge badge-warn">dev: {user.name}</span>;
  if (!isAuthenticated) return <LoginButton className="btn btn-primary btn-sm" />;
  return (
    <>
      <span className="small nav-user">{user?.name || user?.email}</span>
      <LogoutButton className="btn btn-sm" />
    </>
  );
}

export default function Layout() {
  const link = ({ isActive }) => (isActive ? 'nav-link active' : 'nav-link');
  return (
    <>
      <header className="topbar">
        <div className="container topbar-inner">
          <NavLink to="/" className="brand">
            Newcomer Hub <span className="brand-city">Timișoara</span>
          </NavLink>
          <nav className="nav">
            <NavLink to="/lease" className={link}>Lease check</NavLink>
            <NavLink to="/events" className={link}>Events</NavLink>
            <NavLink to="/me" className={link}>Me</NavLink>
          </nav>
          <div className="auth">
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
