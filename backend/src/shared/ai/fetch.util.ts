const RETRYABLE_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EPIPE',
  'EAI_AGAIN',
  'UND_ERR_SOCKET',
  'UND_ERR_CONNECT_TIMEOUT',
]);

// Outbound AI-provider calls sit behind unstable links; a dead pooled socket
// must not fail a citizen-facing answer, so retry transient network errors.
export async function fetchWithRetry(
  url: string | URL,
  init: RequestInit & { retries?: number } = {},
): Promise<Response> {
  const { retries = 2, ...rest } = init;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetch(url, rest);
    } catch (err) {
      lastError = err;
      const code = (err as { cause?: { code?: string } })?.cause?.code ?? '';
      if (!RETRYABLE_CODES.has(code) || attempt === retries) throw err;
      await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
    }
  }
  throw lastError;
}
