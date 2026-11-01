export interface DetectedLanguage {
  code: string;
  name: string;
}

/* Unicode-range heuristic — mirrors AGENTS.md language detection node. */
export function detectLanguageFromUnicode(text: string): DetectedLanguage {
  const sample = text.slice(0, 4000);
  const scripts: Array<{ code: string; name: string; re: RegExp }> = [
    { code: 'hi', name: 'Hindi', re: /[\u0900-\u097F]/ },
    { code: 'bn', name: 'Bengali', re: /[\u0980-\u09FF]/ },
    { code: 'gu', name: 'Gujarati', re: /[\u0A80-\u0AFF]/ },
    { code: 'pa', name: 'Punjabi', re: /[\u0A00-\u0A7F]/ },
    { code: 'ta', name: 'Tamil', re: /[\u0B80-\u0BFF]/ },
    { code: 'te', name: 'Telugu', re: /[\u0C00-\u0C7F]/ },
    { code: 'kn', name: 'Kannada', re: /[\u0C80-\u0CFF]/ },
    { code: 'ml', name: 'Malayalam', re: /[\u0D00-\u0D7F]/ },
    { code: 'or', name: 'Odia', re: /[\u0B00-\u0B7F]/ },
    { code: 'ur', name: 'Urdu', re: /[\u0600-\u06FF]/ },
  ];

  let best: { count: number; hit: DetectedLanguage } | null = null;
  for (const s of scripts) {
    const count = (sample.match(new RegExp(s.re, 'g')) ?? []).length;
    if (count > 0 && (!best || count > best.count)) {
      best = { count, hit: { code: s.code, name: s.name } };
    }
  }
  if (best) return best.hit;
  return { code: 'en', name: 'English' };
}

/* Sarvam expects BCP-47 style codes like 'hi-IN'. */
const SARVAM_SUFFIX: Record<string, string> = {
  hi: 'hi-IN',
  bn: 'bn-IN',
  gu: 'gu-IN',
  pa: 'pa-IN',
  ta: 'ta-IN',
  te: 'te-IN',
  kn: 'kn-IN',
  ml: 'ml-IN',
  or: 'od-IN',
  ur: 'ur-IN',
  en: 'en-IN',
};

export function toSarvamCode(iso: string): string {
  return SARVAM_SUFFIX[iso] ?? 'en-IN';
}
