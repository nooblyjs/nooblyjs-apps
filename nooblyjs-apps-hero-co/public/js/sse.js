// The live channel (/api/v1/events): one EventSource for the page, listeners by event type, reconnect with backoff.

const listeners = new Map();
let source = null;
let retryMs = 1000;
let state = 'closed';

function dispatch(type, data) {
  for (const fn of listeners.get(type) ?? []) fn(data);
  for (const fn of listeners.get('*') ?? []) fn({ type, data });
}

function open(url) {
  source = new EventSource(url, { withCredentials: true });
  state = 'connecting';
  source.addEventListener('open', () => {
    state = 'open';
    retryMs = 1000;
  });
  source.addEventListener('error', () => {
    source.close();
    state = 'retrying';
    setTimeout(() => open(url), retryMs);
    retryMs = Math.min(retryMs * 2, 30_000);
  });
  // Named events: hello now; deploy.*, instance.*, metrics and logs from Phase 2 on.
  for (const type of ['hello', 'infrastructure', 'deploy', 'instance', 'metrics', 'log']) {
    source.addEventListener(type, (e) => dispatch(type, JSON.parse(e.data)));
  }
}

/** Starts the channel once. */
export function connect(url = '/api/v1/events') {
  if (!source && typeof EventSource !== 'undefined') open(url);
}

/** @returns {() => void} stop listening */
export function on(type, fn) {
  if (!listeners.has(type)) listeners.set(type, new Set());
  listeners.get(type).add(fn);
  return () => listeners.get(type).delete(fn);
}

export const connectionState = () => state;
