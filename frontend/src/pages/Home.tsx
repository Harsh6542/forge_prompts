import { Link, useNavigate } from 'react-router-dom';
import { getAuthedUser } from '../lib/http-client.api.js';

const FEATURES = [
  {
    to: '/policy',
    title: 'Policy Explainer',
    body: 'Ask about any government scheme in your language. RAG answers over official content, with voice output.',
  },
  {
    to: '/grievances',
    title: 'Report a Grievance',
    body: 'Report civic issues with photos. AI scores severity and routes your complaint to the responsible department.',
  },
  {
    to: '/services',
    title: 'Service Agent',
    body: 'Watch a browser agent open government portals and fill application forms from your saved profile.',
  },
  {
    to: '/factcheck',
    title: 'Fact Check',
    body: 'Verify viral messages before you forward them — evidence search, image forensics, clear verdict.',
  },
];

export function Home() {
  const navigate = useNavigate();
  const user = getAuthedUser();

  return (
    <>
      <section className="hero">
        <h1>Government schemes, civic complaints and services — without the paperwork maze.</h1>
        <p>
          CivicPulse AI brings four tools into one place: a plain-language policy assistant, an AI grievance
          desk with real accountability, a browser agent that works through legacy portals for you, and a
          fact-check engine for viral civic news.
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
              <h4>{f.title}</h4>
              <p>{f.body}</p>
              <span className="arrow">Open &rarr;</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="card how-strip">
        <h3>How a citizen uses CivicPulse</h3>
        <ol>
          <li>Sign in with your mobile-first account and preferred language.</li>
          <li>Ask policy questions in Hindi, Tamil, Telugu and more — hear the answer read aloud.</li>
          <li>Report a pothole or broken street light with photos; get a tracking ID instantly.</li>
          <li>Let the agent complete a scholarship or PAN application while you watch each step.</li>
          <li>Forward-claimed messages get checked against official sources before you share them.</li>
        </ol>
      </section>
    </>
  );
}
