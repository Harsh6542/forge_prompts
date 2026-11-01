import { useRef, useState } from 'react';
import { streamSse } from '../lib/http-client.api.js';

interface EvidenceItem {
  sourceTitle: string;
  sourceUrl: string;
  excerpt: string;
  credibilityScore: number;
}

interface CompleteEvent {
  reportId: number;
  verdict: string;
  confidence: number;
  reasoning: string;
  evidence: EvidenceItem[];
  deepfakeScore?: number | null;
  recommendation: string;
}

function scoreClass(score: number): string {
  if (score >= 0.8) return 'score-high';
  if (score >= 0.6) return 'score-mid';
  return 'score-low';
}

function scoreLabel(score: number): string {
  if (score >= 0.95) return 'gov official';
  if (score >= 0.8) return 'fact-checker';
  if (score >= 0.7) return 'major news';
  return 'low credibility';
}

export function FactCheckPanel() {
  const [content, setContent] = useState(
    'WhatsApp message claims that the government is giving Rs 5000 to every farmer who registers on a new portal before 15 December. Several relatives forwarded it saying it was announced by the PMO yesterday.',
  );
  const [mediaUrl, setMediaUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [stageFlow, setStageFlow] = useState<string[]>([]);
  const [claims, setClaims] = useState<string[]>([]);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [forensics, setForensics] = useState<{ score: number; assessment: string; findings: string[] } | null>(null);
  const [result, setResult] = useState<CompleteEvent | null>(null);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const run = async () => {
    setBusy(true);
    setError('');
    setStageFlow([]);
    setClaims([]);
    setEvidence([]);
    setForensics(null);
    setResult(null);
    abortRef.current = new AbortController();
    try {
      await streamSse(
        '/factcheck/verify',
        { content, ...(mediaUrl.trim() ? { mediaUrl: mediaUrl.trim() } : {}) },
        (ev) => {
          const stage = String(ev['stage'] ?? '');
          setStageFlow((prev) => (prev.includes(stage) ? prev : [...prev, stage]));
          if (stage === 'claims_found') setClaims((ev['claims'] ?? []) as string[]);
          if (stage === 'evidence_found') {
            setEvidence((prev) => [
              ...prev,
              {
                sourceTitle: String(ev['sourceTitle'] ?? '—'),
                sourceUrl: String(ev['sourceUrl'] ?? ''),
                excerpt: String(ev['excerpt'] ?? ''),
                credibilityScore: Number(ev['credibilityScore'] ?? 0),
              },
            ]);
          }
          if (stage === 'forensics_done') {
            setForensics({
              score: Number(ev['deepfakeScore'] ?? 0),
              assessment: String(ev['overallAssessment'] ?? ''),
              findings: (ev['findings'] ?? []) as string[],
            });
          }
          if (stage === 'complete') setResult(ev as unknown as CompleteEvent);
          if (stage === 'error') setError(String(ev['message'] ?? 'Fact-check failed'));
        },
        abortRef.current.signal,
      );
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel">
      <h2>🔍 Fact-Check Engine</h2>
      <p className="sub">Claims → web evidence → deepfake forensics → verdict, with source credibility scoring.</p>

      <label>Claim / forwarded message / news text *
        <textarea value={content} onChange={(e) => setContent(e.target.value)} />
      </label>
      <label>Image URL (optional — runs Pixtral forensics + deepfake score)
        <input value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} placeholder="https://…/viral-image.jpg" />
      </label>

      <button className="cta" onClick={run} disabled={busy || content.trim().length < 15}>
        {busy ? 'Verifying…' : 'Verify claim'}
      </button>
      {busy && (
        <button className="ghost" onClick={() => abortRef.current?.abort()}>
          Stop
        </button>
      )}

      {stageFlow.length > 0 && (
        <div className="stage-flow">
          {stageFlow.map((s) => (
            <span key={s} className="stage-chip on">
              {s.replace(/_/g, ' ')} ✓
            </span>
          ))}
        </div>
      )}

      {claims.length > 0 && (
        <div className="answer-box" style={{ marginTop: 10 }}>
          <b>Extracted claims</b>
          {'\n'}· {claims.join('\n· ')}
        </div>
      )}

      {evidence.length > 0 && (
        <div className="sources">
          {evidence.map((e, i) => (
            <div key={i} className="src">
              <a href={e.sourceUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--text)' }}>
                📰 {e.sourceTitle}
              </a>
              <span className={`score-pill ${scoreClass(e.credibilityScore)}`}>
                {scoreLabel(e.credibilityScore)} · {Math.round(e.credibilityScore * 100)}
              </span>
            </div>
          ))}
        </div>
      )}

      {forensics && (
        <div className="answer-box" style={{ marginTop: 10 }}>
          🧪 <b>Image forensics</b> — manipulation {Math.round(forensics.score * 100)}/100 ({forensics.assessment.replace(/_/g, ' ')})
          {'\n'}· {forensics.findings.join('\n· ')}
        </div>
      )}

      {result && (
        <>
          <div className={`verdict-banner v-${result.verdict}`}>
            VERDICT: {result.verdict} · confidence {(result.confidence * 100).toFixed(0)}%
            <div className="verify-sub">{result.reasoning}</div>
            <div className="verify-sub" style={{ color: 'var(--accent-2)' }}>💡 {result.recommendation}</div>
          </div>
          {result.evidence.length === 0 && (
            <p className="hint">
              No web evidence was retrieved — live search lights up automatically once SERPAPI_KEY is configured.
            </p>
          )}
        </>
      )}
      {error && <div className="err-box">⚠️ {error}</div>}
    </div>
  );
}
