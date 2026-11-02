import { useRef, useState } from 'react';
import { LANGUAGE_OPTIONS } from '../constants/ui-options.constants.js';
import { streamSse } from '../lib/http-client.api.js';

interface RetrievedSource {
  title: string;
  portalUrl: string;
  relevanceScore: number;
  category: string;
}

const STAGES = [
  ['detecting_language', 'Language detected'],
  ['searching', 'Knowledge base searched'],
  ['found_sources', 'Sources found'],
  ['generating', 'Answer drafted'],
  ['translating', 'Translated'],
  ['generating_voice', 'Voice generated'],
] as const;

export function PolicyExplainer() {
  const [query, setQuery] = useState('किसानों को कौन सी सरकारी योजना में पैसा मिलता है?');
  const [language, setLanguage] = useState('hi');
  const [voice, setVoice] = useState(true);
  const [busy, setBusy] = useState(false);
  const [doneStages, setDoneStages] = useState<Set<string>>(new Set());
  const [answer, setAnswer] = useState('');
  const [translated, setTranslated] = useState('');
  const [sources, setSources] = useState<RetrievedSource[]>([]);
  const [audioUrl, setAudioUrl] = useState('');
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const run = async () => {
    setBusy(true);
    setError('');
    setDoneStages(new Set());
    setAnswer('');
    setTranslated('');
    setSources([]);
    setAudioUrl('');
    abortRef.current = new AbortController();
    try {
      await streamSse(
        '/policy/query',
        { query, language, generateVoice: String(voice) },
        (ev) => {
          const stage = String(ev['stage'] ?? '');
          if (stage === 'streaming_token') {
            setAnswer((prev) => prev + String(ev['token'] ?? ''));
            return;
          }
          if (stage === 'error') {
            setError(String(ev['message'] ?? 'Policy agent error'));
            return;
          }
          setDoneStages((prev) => new Set(prev).add(stage));
          if (stage === 'found_sources') setSources((ev['sources'] ?? []) as RetrievedSource[]);
          if (stage === 'translated') setTranslated(String(ev['text'] ?? ''));
          if (stage === 'voice_ready') setAudioUrl(String(ev['audioUrl'] ?? ''));
        },
        abortRef.current.signal,
      );
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const finalText = translated || answer;

  return (
    <>
      <div className="page-head">
        <h2>Policy Explainer</h2>
        <p>
          Answers are grounded in the ingested policy knowledge base and always cite the scheme's official portal.
        </p>
      </div>

      <div className="card">
        <label>Question (any supported language)</label>
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. How much pension will I get every month and from what age?"
        />
        <div className="row">
          <div>
            <label>Answer language</label>
            <select value={language} onChange={(e) => setLanguage(e.target.value)}>
              {LANGUAGE_OPTIONS.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Voice output</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 8 }}>
              <input id="voicechk" type="checkbox" checked={voice} onChange={(e) => setVoice(e.target.checked)} />
              <span style={{ fontSize: 13.5 }}>
                Read the answer aloud (Sarvam TTS)
              </span>
            </div>
          </div>
        </div>

        <button className="btn" onClick={run} disabled={busy || query.trim().length < 3}>
          {busy ? 'Working…' : 'Get answer'}
        </button>
        {busy && (
          <button className="btn btn-secondary" onClick={() => abortRef.current?.abort()}>
            Stop
          </button>
        )}

        {doneStages.size > 0 && (
          <div style={{ marginTop: 14 }}>
            {STAGES.filter(([key]) => doneStages.has(key)).map(([key, label]) => (
              <div key={key} style={{ fontSize: 12.5, color: 'var(--green)', display: 'inline-block', marginRight: 14 }}>
                {label}
              </div>
            ))}
          </div>
        )}

        <div className="result-box" style={finalText ? undefined : { display: 'none' }}>
          {finalText}
        </div>

        {sources.map((s, i) => (
          <div key={i} className="list-item">
            <span>
              Source: <a href={s.portalUrl} target="_blank" rel="noreferrer">{s.title}</a>
            </span>
            <span className="badge badge-good">{(s.relevanceScore * 100).toFixed(0)}% match</span>
          </div>
        ))}

        {audioUrl && <audio controls src={audioUrl} />}
        {error && <div className="error-note">{error}</div>}
      </div>
    </>
  );
}
