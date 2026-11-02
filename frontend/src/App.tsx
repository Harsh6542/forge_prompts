import { useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout.js';
import { getAuthedUser, type AuthedUser } from './lib/http-client.api.js';
import { FactCheck } from './pages/FactCheck.js';
import { GrievanceReport } from './pages/GrievanceReport.js';
import { Home } from './pages/Home.js';
import { Login } from './pages/Login.js';
import { PolicyExplainer } from './pages/PolicyExplainer.js';
import { ServiceAgent } from './pages/ServiceAgent.js';
import type { ReactNode } from 'react';

function RequireAuth({ user, children }: { user: AuthedUser | null; children: ReactNode }) {
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export default function App() {
  const [user, setUser] = useState<AuthedUser | null>(() => getAuthedUser());

  return (
    <Routes>
      <Route path="/login" element={<Login onSignedIn={() => setUser(getAuthedUser())} />} />
      <Route path="/" element={<AppLayout user={user} onSignedOut={() => setUser(null)} />}>
        <Route index element={<Home />} />
        <Route
          path="policy"
          element={
            <RequireAuth user={user}>
              <PolicyExplainer />
            </RequireAuth>
          }
        />
        <Route
          path="grievances"
          element={
            <RequireAuth user={user}>
              <GrievanceReport citizenName={user?.name ?? 'Citizen'} />
            </RequireAuth>
          }
        />
        <Route
          path="services"
          element={
            <RequireAuth user={user}>
              <ServiceAgent />
            </RequireAuth>
          }
        />
        <Route
          path="factcheck"
          element={
            <RequireAuth user={user}>
              <FactCheck />
            </RequireAuth>
          }
        />
      </Route>
    </Routes>
  );
}
