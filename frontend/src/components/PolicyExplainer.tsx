import { useRef, useState } from 'react';
import { LANGUAGE_OPTIONS } from '../constants/ui-options.constants.js';
import { streamSse } from '../lib/http-client.api.js';

interface RetrievedSource {
  title: string;
  portalUrl: string;
  relevanceScore: number;
  category: string;
}

const STAGE_LABELS: Record<string, string> = {
  detecting_language: 'Language',
  searching: 'RAG search',
  found_sources: 'Sources',
  generating: 'Drafting',
  streaming_token: 'Streaming',
  translating: 'Translating',
  translated: 'Translated',
  generating_voice: 'Voice',
  voice_ready: 'Voice ready',
  complete: 'Done',
};

export function PolicyExplainer() {
  const [query, setQuery] = useState('किसानों को कौन सी सरकारी योजना में पैसा मिलता है?');
  const [language, setLanguage] = useState('hi');
  const [voice, setVoice] = useState(true);
  const [busy, setBusy] = useState(false);
  const [stages, setStages] = useState<string[]>([]);
  const [answer, setAnswer] = useState('');
  const [translated, setTranslated] = useState('');
  const [sources, setSources] = useState<RetrievedSource[]>([]);
  const [audioUrl, setAudioUrl] = useState('');
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const run = async () => {
    setBusy(true);
    setError('');
    setStages([]);
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
          setStages((prev) => (prev.includes(stage) || stage === 'streaming_token' ? prev : [...prev, stage]));
          if (stage === 'streaming_token') setAnswer((prev) => prev + String(ev['token'] ?? ''));
          if (stage === 'found_sources') setSources((ev['sources'] ?? []) as RetrievedSource[]);
          if (stage === 'translated') setTranslated(String(ev['text'] ?? ''));
          if (stage === 'voice_ready') setAudioUrl(String(ev['audioUrl'] ?? ''));
          if (stage === 'error') setError(String(ev['message'] ?? 'Policy agent error'));
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
    <div className="panel">
      <h2>🗣️ Policy Explainer</h2>
      <p className="sub">Hybrid RAG over official scheme content — answers in your language, with voice.</p>

      <textarea value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ask about any Indian government scheme…" />
      <div className="row">
        <label>
          Answer language
          <select value={language} onChange={(e) => setLanguage(e.target.value)}>
            {LANGUAGE_OPTIONS.map((l) => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 33 }}>
          <input type="checkbox" style={{ width: 16, height: 16 }} checked={voice} onChange={(e) => setVoice(e.target.checked)} />
          <span style={{ color: 'var(--text)' }}>Generate voice (Sarvam TTS)</span>
        </label>
      </div>

      <button className="cta" onClick={run} disabled={busy || query.trim().length < 3}>
        {busy ? 'Thinking…' : 'Ask CivicPulse'}
      </button>
      {busy && (
        <button className="ghost" onClick={() => abortRef.current?.abort()}>
          Stop
        </button>
      )}

      {stages.length > 0 && (
        <div className="stage-flow">
          {Object.keys(STAGE_LABELS)
            .filter((s) => stages.includes(s) && s !== 'streaming_token')
            .map((s) => (
              <span key={s} className="stage-chip on">{STAGE_LABELS[s]} ✓</span>
            ))}
        </div>
      )}

      <div className="sources">
        {sources.map((s, i) => (
          <div key={i} className="src">
            <span>
              📚 {s.title} {s.category === 'scheme' ? '' : `(${s.category})`}
            </span>
            <span className="score-pill score-high">{(s.relevanceScore * 100).toFixed(0)}% match</span>
          </div>
        ))}
      </div>

      {finalText && <div className="answer-box">{finalText}</div>}
      {audioUrl && <audio controls src={audioUrl} />}
      {error && <div className="err-box">⚠️ {error}</div>}
    </div>
  );
}
