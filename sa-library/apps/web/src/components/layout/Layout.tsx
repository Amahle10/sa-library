import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <>
      <div className="civic-strip">
        A world of stories. A library near you.<span>Gauteng · South Africa</span>
      </div>
      <header className="site-header">
        <Link className="brand" to="/">
          <span className="brand-icon" aria-hidden="true">
            ▥
          </span>
          SA Library<span className="brand-dot">.</span>
        </Link>
        <nav aria-label="Main navigation">
          <NavLink to="/search">Discover books</NavLink>
          {user && <NavLink to="/my-library">My Library</NavLink>}
          {user && user.role !== 'MEMBER' && <NavLink to="/staff">Staff</NavLink>}
          {user?.role === 'PLATFORM_ADMIN' && <NavLink to="/admin">Admin</NavLink>}
        </nav>
        <div className="account-links">
          {user ? (
            <>
              <span className="user-name">Hi, {user.firstName}</span>
              <button
                className="button small secondary"
                onClick={async () => {
                  await logout().catch(() => undefined);
                  navigate('/');
                }}
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link to="/login">Sign in</Link>
              <Link className="button small" to="/register">
                Join the library
              </Link>
            </>
          )}
        </div>
      </header>
      <main className="container">
        <Outlet />
      </main>
      <footer className="site-footer">
        <Link className="brand" to="/">
          SA Library.
        </Link>
        <p>Find your next chapter, close to home.</p>
        <small>
          Local demonstration · Catalogue, inventory and branch details are sample data.
        </small>
      </footer>
    </>
  );
}
export function StaffNav() {
  return (
    <nav className="tabs" aria-label="Staff navigation">
      {[
        ['/staff', 'Overview'],
        ['/staff/catalogue', 'Catalogue'],
        ['/staff/reservations', 'Reservations'],
        ['/staff/loans', 'Loans'],
        ['/staff/members', 'Members'],
      ].map(([to, label]) => (
        <NavLink key={to} to={to} end>
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
export function MemberNav() {
  return (
    <nav className="tabs" aria-label="My Library navigation">
      {[
        ['/my-library', 'My profile'],
        ['/my-library/reservations', 'Reservations'],
        ['/my-library/loans', 'Borrowed books'],
        ['/my-library/history', 'History'],
      ].map(([to, label]) => (
        <NavLink key={to} to={to} end>
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
