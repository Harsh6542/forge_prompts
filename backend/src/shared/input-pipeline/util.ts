import { createHash } from 'node:crypto';

export function stripJsonFences(raw: string): string {
  return raw
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim();
}

export function parseModelJson<T>(raw: string): T {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  const slice = start >= 0 && end > start ? raw.slice(start, end + 1) : stripJsonFences(raw);
  try {
    return JSON.parse(slice) as T;
  } catch {
    // LLMs sometimes emit raw newlines/tabs inside string literals —
    // converting them to spaces keeps structure valid for our flat payloads.
    const repaired = slice.replace(/[\n\r\t\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ' ');
    return JSON.parse(repaired) as T;
  }
}

export function sha1Short(buf: Buffer): string {
  return createHash('sha1').update(buf).digest('hex').slice(0, 12);
}

export function randomSuffix(len = 6): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}
