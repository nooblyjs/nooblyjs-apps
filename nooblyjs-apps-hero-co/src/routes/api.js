// /api/v1: what the browser asks this app (not the accelerators, which have their own APIs).
import { OPERATORS } from '../platform/realtime.js';

const HEARTBEAT_MS = 25_000;

/**
 * @param {object} o
 * @param {typeof import('express')} o.express
 * @param {ReturnType<import('../platform/session.js').createSession>} o.session
 * @param {ReturnType<import('../platform/realtime.js').createRealtime>} o.realtime
 * @param {() => object[]} o.accelerators   describe() of the mounted accelerators
 * @param {{ name: string, version: string }} o.about
 */
export function createApi({ express, session, realtime, accelerators, about }) {
  const router = express.Router();

  router.get('/about', (req, res) => res.json(about));

  /** The signed-in person and their workspaces (the shell's top bar and switcher). */
  router.get('/me', session.auth, (req, res) => {
    const { id, name, email, emailVerified, githubLogin, operator, workspaces } = req.person;
    res.json({ id, name, email, emailVerified, githubLogin, operator, workspaces });
  });

  /** Operators: what is mounted and what is still to come. */
  router.get('/admin/accelerators', session.requireOperator, (req, res) => res.json({ items: accelerators() }));

  /** Server-Sent Events: the person's workspaces (and the operator channel for operators). */
  router.get('/events', session.auth, (req, res) => {
    res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.flushHeaders();
    const send = (type, data) => res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
    const topics = req.person.workspaces.map((w) => w.id);
    if (req.person.operator) topics.push(OPERATORS);
    send('hello', { person: req.person.id, topics: topics.filter((t) => t !== OPERATORS) });
    const unsubscribe = realtime.subscribe(topics, (event) => send(event.type, { ...event.data, at: event.at }));
    const heartbeat = setInterval(() => res.write(': keep-alive\n\n'), HEARTBEAT_MS);
    heartbeat.unref();
    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });

  router.use((req, res) => res.status(404).json({ error: { code: 'not_found', message: 'No such API route.' } }));
  return router;
}
