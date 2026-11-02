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

function badgeClass(score: number): string {
  if (score >= 0.8) return 'badge-good';
  if (score >= 0.6) return 'badge-warn';
  return 'badge-bad';
}

function credibilityLabel(score: number): string {
  if (score >= 0.95) return 'official (.gov)';
  if (score >= 0.9) return 'PIB';
  if (score >= 0.7) return 'major news';
  if (score >= 0.6) return 'moderate';
  return 'low credibility';
}

export function FactCheck() {
  const [content, setContent] = useState(
    'A WhatsApp forward claims that the government is giving Rs 5000 to every farmer who registers on a new portal before 15 December. Several relatives forwarded it saying it was announced by the PMO yesterday.',
  );
  const [mediaUrl, setMediaUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [doneStages, setDoneStages] = useState<Set<string>>(new Set());
  const [claims, setClaims] = useState<string[]>([]);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [forensics, setForensics] = useState<{ score: number; assessment: string; findings: string[] } | null>(null);
  const [result, setResult] = useState<CompleteEvent | null>(null);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const run = async () => {
    setBusy(true);
    setError('');
    setDoneStages(new Set());
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
          if (stage === 'error') {
            setError(String(ev['message'] ?? 'Fact-check failed'));
            return;
          }
          setDoneStages((prev) => new Set(prev).add(stage));
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
    <>
      <div className="page-head">
        <h2>Fact Check</h2>
        <p>
          Got a WhatsApp forward saying the government is giving free money? Paste it here before you
          share it. We hunt through official sources, scan the photo for signs of tampering, and give
          you a straight answer — true, false or misleading — plus what you should actually do with it.
        </p>
      </div>

      <div className="card">
        <label>Message / claim</label>
        <textarea value={content} onChange={(e) => setContent(e.target.value)} />

        <label>Image URL (optional)</label>
        <input
          value={mediaUrl}
          onChange={(e) => setMediaUrl(e.target.value)}
          placeholder="https://…/viral-image.jpg — runs deepfake forensics"
        />

        <button className="btn" onClick={run} disabled={busy || content.trim().length < 15}>
          {busy ? 'Verifying…' : 'Verify'}
        </button>
        {busy && (
          <button className="btn btn-secondary" onClick={() => abortRef.current?.abort()}>
            Stop
          </button>
        )}

        {doneStages.size > 0 && (
          <div style={{ marginTop: 14 }}>
            {[...doneStages]
              .filter((s) => s !== 'synthesizing')
              .map((s) => (
                <div key={s} style={{ fontSize: 12.5, color: 'var(--green)', display: 'inline-block', marginRight: 14 }}>
                  {s.replace(/_/g, ' ')}
                </div>
              ))}
          </div>
        )}

        {claims.length > 0 && (
          <div className="result-box">{`Extracted claims:\n· ${claims.join('\n· ')}`}</div>
        )}

        {evidence.map((e, i) => (
          <div key={i} className="list-item">
            <span>
              <a href={e.sourceUrl} target="_blank" rel="noreferrer">{e.sourceTitle}</a>
              {e.excerpt && <div style={{ color: 'var(--muted)', fontSize: 12 }}>{e.excerpt.slice(0, 120)}…</div>}
            </span>
            <span className={`badge ${badgeClass(e.credibilityScore)}`}>
              {credibilityLabel(e.credibilityScore)} · {Math.round(e.credibilityScore * 100)}
            </span>
          </div>
        ))}

        {forensics && (
          <div className="result-box">
            {`Image forensics — manipulation score ${Math.round(forensics.score * 100)}/100 (${forensics.assessment.replace(/_/g, ' ')})\n· ${forensics.findings.join('\n· ')}`}
          </div>
        )}

        <div className="result-box" style={result ? undefined : { display: 'none' }}>
          {result?.reasoning ?? ''}
        </div>

        {result && (
          <div className={`verdict-banner v-${result.verdict}`}>
            Verdict: {result.verdict} · confidence {(result.confidence * 100).toFixed(0)}%
            <div className="verdict-sub">{result.recommendation}</div>
          </div>
        )}

        {result && result.evidence.length === 0 && (
          <p className="muted-note">
            No live web evidence for this run — search activates automatically once SERPAPI_KEY is configured.
          </p>
        )}

        {error && <div className="error-note">{error}</div>}
      </div>
    </>
  );
}
