const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3001';

const TOKEN_KEY = 'civicpulse.token';
const USER_KEY = 'civicpulse.user';

export interface AuthedUser {
  id: number;
  name: string;
  email: string;
  role: string;
  department?: string | null;
}

export function getToken(): string {
  return localStorage.getItem(TOKEN_KEY) ?? '';
}

export function getAuthedUser(): AuthedUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthedUser) : null;
  } catch {
    return null;
  }
}

export function saveAuth(token: string, user: AuthedUser): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export class HttpApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function apiRequest<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const message =
      (payload['message'] as string | string[] | undefined) ?? `Request failed (${res.status})`;
    throw new HttpApiError(res.status, Array.isArray(message) ? message.join(', ') : message);
  }
  return payload as T;
}

/** Multipart request — FormData goes through untouched (no Content-Type header). */
export async function apiFormRequest<T>(path: string, form: FormData): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {},
    body: form,
  });
  const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const message =
      (payload['message'] as string | string[] | undefined) ?? `Request failed (${res.status})`;
    throw new HttpApiError(res.status, Array.isArray(message) ? message.join(', ') : message);
  }
  return payload as T;
}

/**
 * POST-based SSE reader — EventSource cannot POST bodies, so we stream manually.
 * onEvent receives each `data:` payload parsed from JSON.
 */
export async function streamSse(
  path: string,
  body: unknown,
  onEvent: (event: Record<string, unknown>) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    const detail = await res.json().catch(() => ({}));
    throw new HttpApiError(res.status, JSON.stringify(detail).slice(0, 200));
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let leftover = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    leftover += decoder.decode(value, { stream: true });
    const parts = leftover.split('\n\n');
    leftover = parts.pop() ?? '';
    for (const part of parts) {
      const line = part.split('\n').find((l) => l.startsWith('data: '));
      if (!line) continue;
      try {
        onEvent(JSON.parse(line.slice(6)) as Record<string, unknown>);
      } catch {
        continue;
      }
    }
  }
}

export const apiBaseUrl = API_BASE;
