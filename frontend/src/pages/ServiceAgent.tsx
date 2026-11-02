import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { SERVICE_OPTIONS } from '../constants/ui-options.constants.js';
import { apiBaseUrl, getToken } from '../lib/http-client.api.js';
import type { AgentStep, AgentTaskDoneEvent, CitizenProfile } from '../types/agent-step.types.js';

const WS_URL = (import.meta.env.VITE_WS_URL as string | undefined) ?? apiBaseUrl;

const STATUS_LABEL: Record<string, string> = {
  running: 'RUNNING',
  success: 'OK',
  failed: 'FAILED',
  waiting: 'WAITING',
};

export function ServiceAgent() {
  const [serviceType, setServiceType] = useState('scholarship');
  const [profile, setProfile] = useState<CitizenProfile>({
    fullName: 'Rahul Sharma',
    mobile: '9876543210',
    email: 'rahul.sharma@example.in',
    dob: '2004-06-15',
    aadhaar: '452198374655',
    state: 'Maharashtra',
    bankAccount: '44712093238',
    address: '14 Shivneri CHS, MG Road, Nashik 422001',
  });
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [done, setDone] = useState<AgentTaskDoneEvent | null>(null);
  const [connected, setConnected] = useState(false);
  const [running, setRunning] = useState(false);
  const socketRef = useRef<ReturnType<typeof io> | null>(null);
  const termRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const socket = io(WS_URL, {
      auth: { token: getToken() },
      transports: ['polling', 'websocket'],
    });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('agent_step', (step: AgentStep) => {
      setSteps((prev) => [...prev, step]);
      if (step.type === 'captcha_detected' && step.status === 'waiting') {
        // Human-in-the-loop step: the citizen solves the CAPTCHA on their phone in real usage.
        setTimeout(() => socket.emit('captcha_solved', { taskId: step.taskId }), 1500);
      }
    });
    socket.on('task_done', (ev: AgentTaskDoneEvent) => {
      setDone(ev);
      setRunning(false);
    });
    socket.on('auth_error', () => setConnected(false));

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    termRef.current?.scrollTo(0, termRef.current.scrollHeight);
  }, [steps]);

  const start = () => {
    setSteps([]);
    setDone(null);
    setRunning(true);
    socketRef.current?.emit('start_task', { serviceType, citizenProfile: profile });
  };

  const set = (k: keyof CitizenProfile) => (e: { target: { value: string } }) =>
    setProfile({ ...profile, [k]: e.target.value });

  return (
    <>
      <div className="page-head">
        <h2>Service Agent</h2>
        <p>
          Government forms are long, confusing and in the wrong language. Pick a service — scholarship,
          PAN card, ration card — and our agent opens the official portal for you, fills your details
          field by field, and ends with an application reference number. You watch every single step it
          takes, live. Nothing real is submitted here; this is a safe demo of the full flow.
        </p>
      </div>

      <div className="card">
        <label>Service</label>
        <select value={serviceType} onChange={(e) => setServiceType(e.target.value)} disabled={running}>
          {SERVICE_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>

        <div className="row">
          <div>
            <label>Full name</label>
            <input value={profile.fullName} onChange={set('fullName')} disabled={running} />
          </div>
          <div>
            <label>Mobile</label>
            <input value={profile.mobile} onChange={set('mobile')} disabled={running} />
          </div>
        </div>
        <div className="row">
          <div>
            <label>Email</label>
            <input value={profile.email} onChange={set('email')} disabled={running} />
          </div>
          <div>
            <label>Date of birth</label>
            <input value={profile.dob ?? ''} onChange={set('dob')} disabled={running} />
          </div>
        </div>
        <div className="row">
          <div>
            <label>Aadhaar (masked in the live log)</label>
            <input value={profile.aadhaar ?? ''} onChange={set('aadhaar')} disabled={running} />
          </div>
          <div>
            <label>Bank account (masked in the live log)</label>
            <input value={profile.bankAccount ?? ''} onChange={set('bankAccount')} disabled={running} />
          </div>
        </div>
        <div className="row">
          <div>
            <label>State</label>
            <input value={profile.state ?? ''} onChange={set('state')} disabled={running} />
          </div>
          <div>
            <label>Address</label>
            <input value={profile.address ?? ''} onChange={set('address')} disabled={running} />
          </div>
        </div>

        <button className="btn" onClick={start} disabled={running || !connected}>
          {running ? 'Agent is working…' : 'Start agent'}
        </button>
        <span className={connected ? 'status-ok' : 'status-off'} style={{ marginLeft: 12 }}>
          {connected ? '● Agent channel connected' : '● Agent channel offline'}
        </span>
      </div>

      {steps.length > 0 && (
        <div className="card">
          <h3>Live agent log</h3>
          <div className="terminal" ref={termRef}>
            {steps.map((s) => (
              <div key={`${s.id}-${s.timestamp}`} className="step-line">
                <span className="step-id">#{String(s.id).padStart(2, '0')}</span>
                <span className={`step-tag ${s.status === 'failed' ? 't-failed' : s.status === 'waiting' ? 't-waiting' : ''}`}>
                  {STATUS_LABEL[s.status] ?? s.status}
                </span>
                <span className="step-msg">
                  <b>{s.type.replace(/_/g, ' ')}</b> — {s.message}
                  {s.fieldName && (
                    <span>
                      {' '}· {s.fieldName} = <b>{s.fieldValue}</b>
                    </span>
                  )}
                  {s.screenshotUrl && (
                    <>
                      {' '}
                      <a className="sshot" href={s.screenshotUrl} target="_blank" rel="noreferrer">
                        [screenshot]
                      </a>
                    </>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {done && (
        <div className="card">
          {done.trackingNumber ? (
            <>
              <div className="stat-grid">
                <div className="stat stat-highlight">
                  <div className="k">Application reference</div>
                  <div className="v done-ref">{done.trackingNumber}</div>
                </div>
                <div className="stat">
                  <div className="k">Portal</div>
                  <div className="v">{done.url ?? 'Government portal'}</div>
                </div>
              </div>
              <p className="muted-note">Reference number generated in demo mode — no real application was filed.</p>
            </>
          ) : (
            <div className="error-note">Task ended without a reference — {done.error ?? done.taskId}</div>
          )}
        </div>
      )}
    </>
  );
}
