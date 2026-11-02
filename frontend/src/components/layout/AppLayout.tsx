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
              <div className="brand-name">CivicPulse AI</div>
              <div className="brand-tag">Your AI-powered civic rights assistant</div>
            </span>
          </NavLink>
          {user ? (
            <div className="userbox">
              <span>
                Signed in as <b>{user.name}</b> ({user.role})
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
      <nav className="site-nav">
        <div className="nav-inner">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
      <main className="page">
        <Outlet />
      </main>
    </>
  );
}
