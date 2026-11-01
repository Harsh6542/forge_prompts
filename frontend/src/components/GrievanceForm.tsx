import { useState } from 'react';
import { CATEGORY_OPTIONS } from '../constants/ui-options.constants.js';
import { apiFormRequest } from '../lib/http-client.api.js';

interface ImageForensics {
  issueType: string;
  severityScore: number;
  severityReason: string;
  safetyRisk: string;
  immediateActionRequired: boolean;
  observations: string[];
}

interface TriageResult {
  generatedTrackingId: string;
  grievancePriority: string;
  assignedDepartment: string;
  estimatedResolutionSla: string;
  aiImageForensicsAnalysis: ImageForensics | null;
  grievance: {
    finalSeverityScore: number;
    mediaUrls: string[];
    aiAnalysis: {
      textSeverity?: { severityScore: number; urgency: string; keyIssues: string[] };
      scoringModel?: string;
    };
  };
}

export function GrievanceForm({ citizenName }: { citizenName: string }) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'road',
    location: '',
    state: '',
  });
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TriageResult | null>(null);
  const [error, setError] = useState('');

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm({ ...form, [k]: e.target.value });

  const submit = async () => {
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const fd = new FormData();
      for (const [k, v] of Object.entries(form)) fd.append(k, v);
      files.slice(0, 3).forEach((f) => fd.append('media', f));
      setResult(await apiFormRequest<TriageResult>('/grievance/submit', fd));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const forensics = result?.aiImageForensicsAnalysis;
  const textIssues = result?.grievance?.aiAnalysis?.textSeverity?.keyIssues ?? [];

  return (
    <div className="panel">
      <h2>📸 Grievance Triage</h2>
      <p className="sub">Report a civic issue with photos — AI scores severity and routes it to the right department.</p>

      <label>Title (optional)
        <input value={form.title} onChange={set('title')} placeholder="Short summary" />
      </label>
      <label>Description *
        <textarea value={form.description} onChange={set('description')}
          placeholder="What happened, who is affected, since when…" />
      </label>
      <div className="row">
        <label>Category *
          <select value={form.category} onChange={set('category')}>
            {CATEGORY_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </label>
        <label>State (for tracking ID)
          <input value={form.state} onChange={set('state')} placeholder="Maharashtra" />
        </label>
      </div>
      <label>Location *
        <input value={form.location} onChange={set('location')} placeholder="Ward, street, landmark…" />
      </label>
      <label>Photos (up to 3 — improves severity accuracy)
        <input type="file" accept="image/*" multiple
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
      </label>
      {files.length > 0 && <div className="sub" style={{ marginTop: 6 }}>{files.length} photo(s) attached</div>}

      <button className="cta" onClick={submit} disabled={busy || form.description.length < 10}>
        {busy ? 'Triaging through AI…' : `Submit as ${citizenName}`}
      </button>
      {error && <div className="err-box">⚠️ {error}</div>}

      {result && (
        <>
          <div className="result-grid">
            <div className="stat tracking-btn"><div className="k">Tracking ID</div><div className="v">{result.generatedTrackingId}</div></div>
            <div className="stat"><div className="k">Priority</div><div className={`v prio-${result.grievancePriority}`}>{result.grievancePriority}</div></div>
            <div className="stat"><div className="k">Severity</div><div className="v">{result.grievance.finalSeverityScore} / 10</div></div>
            <div className="stat"><div className="k">SLA</div><div className="v">{result.estimatedResolutionSla}</div></div>
            <div className="stat"><div className="k">Routed to</div><div className="v">{result.assignedDepartment}</div></div>
          </div>

          {forensics && (
            <div className="answer-box" style={{ marginTop: 12 }}>
              🔎 <b>Image forensics</b> — {forensics.issueType} · image severity {forensics.severityScore}/10 · safety risk {forensics.safetyRisk}
              {'\n'}{forensics.severityReason}
              {'\n\n'}Observations:
              {'\n'}· {forensics.observations.join('\n· ')}
              {forensics.immediateActionRequired ? '\n\n⚡ Immediate action flagged' : ''}
            </div>
          )}
          {textIssues.length > 0 && (
            <div className="answer-box" style={{ marginTop: 10 }}>
              🧾 <b>Key issues (text AI)</b> — {result.grievance.aiAnalysis.textSeverity?.urgency}
              {'\n'}· {textIssues.join('\n· ')}
            </div>
          )}
          <p className="hint">Track anytime with: GET /grievance/track/{result.generatedTrackingId}</p>
        </>
      )}
    </div>
  );
}
