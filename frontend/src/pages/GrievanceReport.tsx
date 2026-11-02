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

export function GrievanceReport({ citizenName }: { citizenName: string }) {
  const [form, setForm] = useState({ title: '', description: '', category: 'road', location: '', state: '' });
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

  const forensics = result?.aiImageForensicsAnalysis ?? null;
  const textIssues = result?.grievance?.aiAnalysis?.textSeverity?.keyIssues ?? [];

  return (
    <>
      <div className="page-head">
        <h2>Report a Grievance</h2>
        <p>
          Your report is scored by AI, routed to the responsible department, and gets a tracking ID you can
          share. Photos improve severity accuracy.
        </p>
      </div>

      <div className="card">
        <label>Title</label>
        <input value={form.title} onChange={set('title')} placeholder="Short summary (optional)" />

        <label>Description</label>
        <textarea
          value={form.description}
          onChange={set('description')}
          placeholder="What happened, who is affected, since when…"
        />

        <div className="row">
          <div>
            <label>Category</label>
            <select value={form.category} onChange={set('category')}>
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label>State (used in tracking ID)</label>
            <input value={form.state} onChange={set('state')} placeholder="Maharashtra" />
          </div>
        </div>

        <label>Location</label>
        <input value={form.location} onChange={set('location')} placeholder="Ward, street, landmark…" />

        <label>Photos</label>
        <input type="file" accept="image/*" multiple onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />

        <button className="btn" onClick={submit} disabled={busy || form.description.trim().length < 10}>
          {busy ? 'Triaging…' : `Submit as ${citizenName}`}
        </button>
        {error && <div className="error-note">{error}</div>}
      </div>

      {result && (
        <div className="card">
          <div className="stat-grid">
            <div className="stat stat-highlight">
              <div className="k">Tracking ID</div>
              <div className="v">{result.generatedTrackingId}</div>
            </div>
            <div className="stat">
              <div className="k">Priority</div>
              <div className={`v prio-${result.grievancePriority}`}>{result.grievancePriority}</div>
            </div>
            <div className="stat">
              <div className="k">Severity</div>
              <div className="v">{result.grievance.finalSeverityScore} / 10</div>
            </div>
            <div className="stat">
              <div className="k">Expected resolution</div>
              <div className="v">{result.estimatedResolutionSla}</div>
            </div>
            <div className="stat">
              <div className="k">Routed to</div>
              <div className="v">{result.assignedDepartment}</div>
            </div>
          </div>

          {forensics && (
            <div className="result-box">
              {`Image analysis — ${forensics.issueType.replace(/_/g, ' ')} · severity ${forensics.severityScore}/10 · safety risk ${forensics.safetyRisk}\n${forensics.severityReason}\n\nObservations:\n· ${forensics.observations.join('\n· ')}${forensics.immediateActionRequired ? '\n\nFlagged for immediate action.' : ''}`}
            </div>
          )}

          {textIssues.length > 0 && (
            <div className="result-box">
              {`Text analysis — ${result.grievance.aiAnalysis?.textSeverity?.urgency ?? 'normal'} urgency\n· ${textIssues.join('\n· ')}`}
            </div>
          )}

          <p className="muted-note">
            Track anytime with GET /grievance/track/{result.generatedTrackingId} (public link).
          </p>
        </div>
      )}
    </>
  );
}
