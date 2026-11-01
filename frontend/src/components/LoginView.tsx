import { useState } from 'react';
import { apiRequest, getAuthedUser, getToken, saveAuth } from '../lib/http-client.api.js';

interface AuthResponse {
  accessToken: string;
  user: { id: number; name: string; email: string; role: string; department?: string | null };
}

export function LoginView({ onAuthed }: { onAuthed: () => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [form, setForm] = useState({ name: 'Test Citizen', email: 't1@test.com', password: 'Abcdefg1' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      let auth: AuthResponse;
      if (mode === 'login') {
        auth = await apiRequest<AuthResponse>('/auth/login', {
          method: 'POST',
          body: { email: form.email, password: form.password },
        });
      } else {
        await apiRequest('/auth/register', {
          method: 'POST',
          body: { name: form.name, email: form.email, password: form.password, role: 'public_user' },
        });
        auth = await apiRequest<AuthResponse>('/auth/login', {
          method: 'POST',
          body: { email: form.email, password: form.password },
        });
      }
      saveAuth(auth.accessToken, auth.user);
      onAuthed();
    } catch (err) {
      setError((err as Error).message ?? 'Authentication failed');
    } finally {
      setBusy(false);
    }
  };

  const skip = () => {
    // quick-entry using stored token if present (e.g. page reload)
    if (getToken() && getAuthedUser()) onAuthed();
  };

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-brand">
          <span className="pulse-dot" />
          <div>
            <h1>CivicPulse AI</h1>
            <p>Your AI-powered civic rights assistant</p>
          </div>
        </div>

        <div className="seg-btns">
          <button className={mode === 'login' ? 'seg active' : 'seg'} onClick={() => setMode('login')}>
            Sign in
          </button>
          <button className={mode === 'register' ? 'seg active' : 'seg'} onClick={() => setMode('register')}>
            Register
          </button>
        </div>

        {mode === 'register' && (
          <label>
            Full name
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Your name"
            />
          </label>
        )}
        <label>
          Email
          <input
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="you@example.in"
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="8+ chars"
          />
        </label>

        {error && <div className="err-box">{error}</div>}

        <button className="cta" onClick={submit} disabled={busy}>
          {busy ? 'Working…' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>
        <button className="ghost" onClick={skip}>
          Continue with saved session
        </button>
        <p className="hint">Demo credentials are pre-filled — t1@test.com / Abcdefg1</p>
      </div>
    </div>
  );
}
