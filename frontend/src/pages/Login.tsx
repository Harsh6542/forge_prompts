import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest, saveAuth } from '../lib/http-client.api.js';

interface AuthResponse {
  accessToken: string;
  user: { id: number; name: string; email: string; role: string; department?: string | null };
}

export function Login({ onSignedIn }: { onSignedIn: () => void }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [form, setForm] = useState({ name: 'Test Citizen', email: 't1@test.com', password: 'Abcdefg1' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const signIn = async (email: string, password: string) => {
    const auth = await apiRequest<AuthResponse>('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    saveAuth(auth.accessToken, auth.user);
    onSignedIn();
    navigate('/policy');
  };

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      if (mode === 'register') {
        await apiRequest('/auth/register', {
          method: 'POST',
          body: { name: form.name, email: form.email, password: form.password, role: 'public_user' },
        });
      }
      await signIn(form.email, form.password);
    } catch (err) {
      setError((err as Error).message ?? 'Authentication failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-switch">
          <button className={mode === 'login' ? 'on' : ''} onClick={() => setMode('login')}>
            Sign in
          </button>
          <button className={mode === 'register' ? 'on' : ''} onClick={() => setMode('register')}>
            Create account
          </button>
        </div>

        {mode === 'register' && (
          <label>
            Full name
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
        )}
        <label>
          Email
          <input
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="you@example.in"
            autoComplete="username"
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            autoComplete="current-password"
          />
        </label>

        {error && <div className="error-note">{error}</div>}

        <button className="btn" style={{ width: '100%' }} onClick={submit} disabled={busy}>
          {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Register and sign in'}
        </button>
        <p className="muted-note" style={{ textAlign: 'center' }}>
          Demo account pre-filled: t1@test.com / Abcdefg1
        </p>
      </div>
    </div>
  );
}
