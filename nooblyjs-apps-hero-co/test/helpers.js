// Test helpers: start the real app (nooblyjs-core + the accelerators on the mock cloud) on an ephemeral port with its
// own data folder under .temp/tests, and call it as a person. nooblyjs-core's registry is one per process, so each
// test file starts the app once (node --test runs every file in its own process).
//
// The server listens before the app is built, so PUBLIC_URL carries the real port: passport-github2 calls the mock
// GitHub at that address.
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { createApp } from '../src/app.js';
import { loadConfig, ROOT } from '../src/config.js';

export const TEMP = path.join(ROOT, '.temp', 'tests');

export async function tempDir(prefix = 'data-') {
  await fs.mkdir(TEMP, { recursive: true });
  return fs.mkdtemp(path.join(TEMP, prefix));
}

export function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => resolve({ server, base: `http://127.0.0.1:${server.address().port}` }));
  });
}

/**
 * fetch as a person: `as` sets the X-Dev-Person header, `cookie` sends raw cookies, `jar` keeps cookies between calls
 * (a browser), `form` sends application/x-www-form-urlencoded.
 */
export function caller(base) {
  return async (method, url, { as, cookie, jar, body, form, headers = {}, redirect = 'manual' } = {}) => {
    const res = await fetch(new URL(url, base), {
      method,
      redirect,
      headers: {
        ...(as ? { 'x-dev-person': as } : {}),
        ...(cookie ? { cookie } : {}),
        ...(jar ? { cookie: jar.header() } : {}),
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(form ? { 'content-type': 'application/x-www-form-urlencoded' } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : form ? new URLSearchParams(form).toString() : undefined,
    });
    jar?.take(res);
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch { /* not JSON */ }
    return { status: res.status, headers: res.headers, text, json, location: res.headers.get('location') };
  };
}

/** A cookie jar: what a browser would send back. */
export function cookieJar() {
  const cookies = new Map();
  return {
    take(res) {
      for (const line of res.headers.getSetCookie()) {
        const [pair, ...attrs] = line.split(';');
        const eq = pair.indexOf('=');
        const name = pair.slice(0, eq).trim();
        const value = pair.slice(eq + 1).trim();
        if (attrs.some((a) => /max-age=0/i.test(a.trim())) || value === '') cookies.delete(name);
        else cookies.set(name, value);
      }
    },
    get: (name) => cookies.get(name),
    header: () => [...cookies].map(([k, v]) => `${k}=${v}`).join('; '),
  };
}

export async function startApp(options = {}) {
  const dataDir = await tempDir();
  const server = http.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const config = { ...loadConfig({ NODE_ENV: 'test' }), dataDir, publicUrl: base, ...(options.config ?? {}) };
  const hero = await createApp({ config, mockStepMs: 0, jobCheckMs: 0, ...options, ...(options.config ? { config } : {}) });
  server.on('request', hero.app);
  hero.attachUpgrades(server);
  const call = caller(base);
  const outbox = () => hero.accelerators.mounted.customers.marketing.channels.email.outbox;
  return {
    ...hero,
    base,
    dataDir,
    call,
    get: (url, o) => call('GET', url, o),
    post: (url, o) => call('POST', url, o),
    patch: (url, o) => call('PATCH', url, o),
    del: (url, o) => call('DELETE', url, o),
    outbox,
    /** The link in the newest email to `to` whose subject matches, resolved through the click tracker. */
    async linkFor(to, subject) {
      const mail = [...outbox()].reverse().find((m) => m.to === to && subject.test(m.subject));
      if (!mail) throw new Error(`No email to ${to} matching ${subject}`);
      const tracked = mail.text.match(/https?:\/\/\S+/)[0];
      const res = await call('GET', tracked.replace(base, ''));
      return new URL(res.location ?? tracked);
    },
    async close() {
      await new Promise((resolve) => server.close(resolve));
      server.closeAllConnections?.();
      await hero.shutdown();
      await fs.rm(dataDir, { recursive: true, force: true });
    },
  };
}
