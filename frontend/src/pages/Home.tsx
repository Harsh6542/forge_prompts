import { Link, useNavigate } from 'react-router-dom';
import { getAuthedUser } from '../lib/http-client.api.js';

const FEATURES = [
  {
    to: '/policy',
    title: 'Policy Explainer',
    body: 'Ask about any government scheme in your language. Grounded answers over official content, with voice output.',
    icon: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      </svg>
    ),
  },
  {
    to: '/grievances',
    title: 'Report a Grievance',
    body: 'Report civic issues with photos. AI scores severity and routes your complaint to the responsible department.',
    icon: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
        <circle cx="12" cy="13" r="4" />
      </svg>
    ),
  },
  {
    to: '/services',
    title: 'Service Agent',
    body: 'Watch a browser agent open government portals and fill application forms from your saved profile.',
    icon: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
  },
  {
    to: '/factcheck',
    title: 'Fact Check',
    body: 'Verify viral messages before you forward them — evidence search, image forensics, a clear verdict.',
    icon: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <polyline points="9 12 11 14 15 10" />
      </svg>
    ),
  },
];

export function Home() {
  const navigate = useNavigate();
  const user = getAuthedUser();

  return (
    <>
      <section className="hero">
        <div className="hero-orbs" aria-hidden="true">
          <span className="orb orb-a" />
          <span className="orb orb-b" />
        </div>
        <p className="kicker">
          <span className="kicker-dot" />
          One assistant · Four civic superpowers
        </p>
        <h1>
          Government schemes, complaints and services —{' '}
          <span className="hero-grad">without the paperwork maze.</span>
        </h1>
        <p>
          JanSetu brings a plain-language policy assistant, an AI grievance desk with real
          accountability, a browser agent that works through legacy portals for you, and a fact-check
          engine for viral civic news — all in one place.
        </p>
        {user ? (
          <button className="btn" onClick={() => navigate('/policy')}>
            Open the dashboard
          </button>
        ) : (
          <button className="btn" onClick={() => navigate('/login')}>
            Sign in to get started
          </button>
        )}
      </section>

      <section>
        <div className="feature-grid">
          {FEATURES.map((f) => (
            <Link key={f.to} to={f.to} className="feature-card">
              <span className="feature-icon">{f.icon}</span>
              <h4>{f.title}</h4>
              <p>{f.body}</p>
              <span className="arrow">Open &rarr;</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="card how-strip">
        <h3>How a citizen uses JanSetu</h3>
        <ol>
          <li>Sign in with your account and preferred language.</li>
          <li>Ask policy questions in Hindi, Tamil, Telugu and more — hear the answer read aloud.</li>
          <li>Report a pothole or broken street light with photos; get a tracking ID instantly.</li>
          <li>Let the agent complete a scholarship or PAN application while you watch each step.</li>
          <li>Check forwarded messages against official sources before sharing them.</li>
        </ol>
      </section>
    </>
  );
}
