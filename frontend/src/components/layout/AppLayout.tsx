import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { clearAuth, type AuthedUser } from '../../lib/http-client.api.js';

const NAV_ITEMS = [
  { to: '/policy', label: 'Policy Explainer' },
  { to: '/grievances', label: 'Report Grievance' },
  { to: '/services', label: 'Service Agent' },
  { to: '/factcheck', label: 'Fact Check' },
];

export function AppLayout({ user, onSignedOut }: { user: AuthedUser | null; onSignedOut: () => void }) {
  const navigate = useNavigate();

  const signOut = () => {
    clearAuth();
    onSignedOut();
    navigate('/login');
  };

  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <NavLink to="/" className="brand">
            <span className="brand-mark">CP</span>
            <span>
              <div className="brand-name">JanSetu</div>
              <div className="brand-tag">AI-powered bridge between citizens &amp; governance</div>
            </span>
          </NavLink>
          <nav className="site-nav">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          {user ? (
            <div className="userbox">
              <span>
                <b>{user.name}</b> · {user.role}
              </span>
              <button className="btn-quiet" onClick={signOut}>
                Sign out
              </button>
            </div>
          ) : (
            <div className="userbox">
              <button className="btn-quiet" onClick={() => navigate('/login')}>
                Sign in
              </button>
            </div>
          )}
        </div>
      </header>
      <main className="page">
        <Outlet />
      </main>
    </>
  );
}
