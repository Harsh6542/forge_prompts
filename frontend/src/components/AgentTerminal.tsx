import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { SERVICE_OPTIONS } from '../constants/ui-options.constants.js';
import { getToken } from '../lib/http-client.api.js';
import type { AgentStep, AgentTaskDoneEvent, CitizenProfile } from '../types/agent-step.types.js';

const STATUS_CLASS: Record<string, string> = {
  running: 't-running',
  success: 't-success',
  failed: 't-failed',
  waiting: 't-waiting',
};

export function AgentTerminal() {
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
    const socket = io('http://localhost:3001/agent', { auth: { token: getToken() } });
    socketRef.current = socket;
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('agent_step', (step: AgentStep) => {
      setSteps((prev) => [...prev, step]);
      if (step.type === 'captcha_detected' && step.status === 'waiting') {
        // simulated human-in-the-loop: citizen solves CAPTCHA in the real app
        setTimeout(() => socket.emit('captcha_solved', { taskId: step.taskId }), 1500);
      }
    });
    socket.on('task_done', (ev: AgentTaskDoneEvent) => {
      setDone(ev);
      setRunning(false);
    });
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
    <div className="panel">
      <h2>🤖 Service Agent</h2>
      <p className="sub">
        Autonomous browser agent fills government portal forms on your behalf —{' '}
        {connected ? <span style={{ color: 'var(--accent-2)' }}>connected</span> : <span style={{ color: 'var(--danger)' }}>disconnected</span>}
        {' · '}demo mode (no real submissions)
      </p>

      <label>Service to apply for
        <select value={serviceType} onChange={(e) => setServiceType(e.target.value)} disabled={running}>
          {SERVICE_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </label>
      <div className="row">
        <label>Full name<input value={profile.fullName} onChange={set('fullName')} disabled={running} /></label>
        <label>Mobile<input value={profile.mobile} onChange={set('mobile')} disabled={running} /></label>
      </div>
      <div className="row">
        <label>Email<input value={profile.email} onChange={set('email')} disabled={running} /></label>
        <label>Date of birth<input value={profile.dob ?? ''} onChange={set('dob')} disabled={running} /></label>
      </div>
      <div className="row">
        <label>Aadhaar<input value={profile.aadhaar ?? ''} onChange={set('aadhaar')} disabled={running} /></label>
        <label>State<input value={profile.state ?? ''} onChange={set('state')} disabled={running} /></label>
      </div>
      <label>Address<input value={profile.address ?? ''} onChange={set('address')} disabled={running} /></label>

      <button className="cta" onClick={start} disabled={running || !connected}>
        {running ? 'Agent working…' : 'Start agent (watch it work)'}
      </button>

      {steps.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <p className="sub">Agent steps (streamed over WebSocket):</p>
          <div className="terminal" ref={termRef}>
            {steps.map((s) => (
              <div key={`${s.id}-${s.timestamp}`} className="step-line">
                <span className="step-id">#{String(s.id).padStart(2, '0')}</span>
                <span className={`step-tag ${STATUS_CLASS[s.status] ?? ''}`}>{s.status}</span>
                <span>
                  <b style={{ textTransform: 'capitalize' }}>{s.type.replace(/_/g, ' ')}</b> — {s.message}
                  {s.fieldName && (
                    <span>
                      {' '}· {s.fieldName} = <b>{s.fieldValue}</b>
                    </span>
                  )}
                  {s.screenshotUrl && (
                    <>
                      {' '}
                      <a className="sshot" href={s.screenshotUrl} target="_blank" rel="noreferrer">[view screenshot]</a>
                    </>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {done && (
        <div className="done-card">
          <span style={{ fontSize: 26 }}>{done.trackingNumber ? '✅' : '⚠️'}</span>
          <div>
            {done.trackingNumber ? (
              <>
                Application submitted to {done.url ?? 'portal'}
                <div className="ref">{done.trackingNumber}</div>
                <span className="sub" style={{ fontSize: 11.5 }}>{done.taskId}</span>
              </>
            ) : (
              <>
                Task ended without a reference number
                <div className="sub" style={{ fontSize: 12 }}>{done.error ?? done.taskId}</div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
