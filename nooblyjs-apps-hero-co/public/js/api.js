// fetch for this app's API: JSON in and out, the CSRF token on every write (double-submit cookie `noobly.csrf`, the
// name the nooblyjs-core /ui kit uses), and the server's { error: { code, message } } turned into an ApiError.

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function csrfToken(cookie = globalThis.document?.cookie ?? '') {
  const match = /(?:^|;\s*)noobly\.csrf=([^;]+)/.exec(cookie);
  return match ? decodeURIComponent(match[1]) : '';
}

/**
 * @param {string} path   e.g. '/api/v1/me'
 * @param {{ method?: string, body?: unknown, signal?: AbortSignal }} [o]
 */
export async function api(path, { method = 'GET', body, signal } = {}) {
  const res = await fetch(path, {
    method,
    signal,
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(method === 'GET' ? {} : { 'X-CSRF-Token': csrfToken() }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch { /* not JSON */ }
  if (!res.ok) {
    throw new ApiError(res.status, json?.error?.code ?? 'error', json?.error?.message ?? `The request failed (${res.status}).`, json?.error?.details);
  }
  return json;
}
