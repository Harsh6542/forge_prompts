import { useEffect, useState } from 'react';
import { AgentTerminal } from './components/AgentTerminal.js';
import { FactCheckPanel } from './components/FactCheckPanel.js';
import { GrievanceForm } from './components/GrievanceForm.js';
import { LoginView } from './components/LoginView.js';
import { PolicyExplainer } from './components/PolicyExplainer.js';
import { clearAuth, getAuthedUser, type AuthedUser } from './lib/http-client.api.js';

type Tab = 'policy' | 'grievance' | 'agent' | 'factcheck';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'policy', label: '🗣️ Policy Explainer' },
  { id: 'grievance', label: '📸 Grievance' },
  { id: 'agent', label: '🤖 Service Agent' },
  { id: 'factcheck', label: '🔍 Fact-Check' },
];

export default function App() {
  const [user, setUser] = useState<AuthedUser | null>(() => getAuthedUser());
  const [tab, setTab] = useState<Tab>('policy');

  useEffect(() => {
    if (typeof document !== 'undefined') document.title = 'CivicPulse AI — Civic Rights Assistant';
  }, []);

  if (!user) {
    return <LoginView onAuthed={() => setUser(getAuthedUser())} />;
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="pulse-dot" />
          <div>
            <h1>CivicPulse AI</h1>
            <p>Schemes · Grievances · Services · Verification</p>
          </div>
        </div>
        <div className="user-chip">
          <span>
            <b>{user.name}</b> · {user.role}
          </span>
          <button
            className="out-btn"
            onClick={() => {
              clearAuth();
              setUser(null);
            }}
          >
            Sign out
          </button>
        </div>
      </header>

      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'tab active' : 'tab'} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'policy' && <PolicyExplainer />}
      {tab === 'grievance' && <GrievanceForm citizenName={user.name} />}
      {tab === 'agent' && <AgentTerminal />}
      {tab === 'factcheck' && <FactCheckPanel />}

      <p className="hint" style={{ marginTop: 26 }}>
        CivicPulse AI backend · Swagger: <code>localhost:3001/api/docs</code> · agents stream over SSE &amp; WebSocket
      </p>
    </div>
  );
}
