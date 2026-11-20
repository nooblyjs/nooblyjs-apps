// Who is signed in, and the gates every route uses.
//
// The session also carries `authToken`, core's own session token (set at sign-in exactly as core's login route does),
// so nooblyjs-core's /services gate recognises the same sign-in.
//
// A sign-in is an express-session (cookie `hero.sid`, store from nooblyjs-core's createSessionStore: memory, or Redis
// when REDIS_URL / SESSION_REDIS_URL is set) holding the person's id and their session epoch. Changing or resetting a
// password bumps the epoch, which signs out every other session. Outside production the X-Dev-Person header (tests,
// curl) and the /dev/login picker can sign in as any person; neither exists in production.
//
// Writes from a cookie sign-in, and the sign-in forms themselves, need the double-submit CSRF token (cookie
// `noobly.csrf`, header X-CSRF-Token: the name nooblyjs-core's /ui kit uses) or a same-origin Origin/Referer (the
// customers accelerator's admin UI sends no token).
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import expressSession from 'express-session';
import { toPerson } from './people.js';

const require = createRequire(import.meta.url);
const { createSessionStore } = require('nooblyjs-core/src/shared/utils/sessionStore.js');

export const PERSON_HEADER = 'x-dev-person';
export const SESSION_COOKIE = 'hero.sid';
export const CSRF_COOKIE = 'noobly.csrf';
const READS = new Set(['GET', 'HEAD', 'OPTIONS']);
const SESSION_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const DEV_SECRET = 'nooblyjs-cloud-development-session-secret';

export function readCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie ?? '').split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0) {
      try {
        out[part.slice(0, eq).trim()] = decodeURIComponent(part.slice(eq + 1).trim());
      } catch { /* malformed: skip */ }
    }
  }
  return out;
}

const isApi = (req) => req.originalUrl.split('?')[0].includes('/api/');
const sendError = (res, status, code, message) => res.status(status).json({ error: { code, message } });
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
export const safeNext = (next) => (typeof next === 'string' && /^\/(?![/\\])/.test(next) ? next : null);

/**
 * The one sign-in screen: nooblyjs-core's authservice login page. It posts to /services/authservice/api/login, which
 * this app answers (auth.js coreLoginRoutes), and then goes to `returnUrl`: the page the person was heading to, or
 * their home (their workspace for customers, /admin for operators).
 */
export const LOGIN_PAGE = '/services/authservice/views/login.html';
export const loginUrl = (next) => (safeNext(next) ? `${LOGIN_PAGE}?returnUrl=${encodeURIComponent(next)}` : LOGIN_PAGE);

/** The login page and the files it loads: the only /services paths open to people who are not platform operators. */
export const LOGIN_ASSETS = new Set([
  LOGIN_PAGE,
  '/services/authservice/views/js/login.page.js',
  '/services/css/styles.css',
  '/services/css/core.css',
  '/services/css/auth-login.css',
]);
const notFound = (req, res, what = 'page') => (isApi(req) ? sendError(res, 404, 'not_found', `No such ${what}.`) : res.status(404).type('text').send('Not found.'));

/**
 * @param {object} o
 * @param {ReturnType<import('./accounts.js').createAccounts>} o.accounts
 * @param {{ production: boolean, devSignIn: boolean, sessionSecret?: string }} o.config
 * @param {object} [o.log]
 */
export function createSession({ accounts, config, log }) {
  if (config.production && !config.sessionSecret) throw new Error('SESSION_SECRET is required in production.');
  const store = createSessionStore(expressSession, { logger: log });
  const cookie = expressSession({
    name: SESSION_COOKIE,
    store: store.store,
    secret: config.sessionSecret ?? DEV_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', secure: config.production, maxAge: SESSION_MAX_AGE_MS, path: '/' },
  });
  const secureFlag = config.production ? '; Secure' : '';
  const csrfCookie = (value) => `${CSRF_COOKIE}=${value}; Path=/; SameSite=Lax${secureFlag}`;
  const newCsrf = () => crypto.randomBytes(24).toString('base64url');

  /** The person a record is, with their workspaces. */
  async function load(record) {
    return record ? toPerson(record, await accounts.workspacesFor(record.id)) : null;
  }

  /** Sets req.person (or null), and a CSRF cookie when there is none. Never refuses. */
  async function identify(req, res, next) {
    try {
      if (req.person === undefined) {
        req.person = null;
        const header = config.devSignIn ? req.get(PERSON_HEADER) : undefined;
        if (header) {
          req.signedInBy = 'header';
          const record = (await accounts.getPerson(header)) ?? (await accounts.findPersonByEmail(header));
          req.person = await load(record);
        } else if (req.session?.personId) {
          req.signedInBy = 'cookie';
          const record = await accounts.getPerson(req.session.personId);
          if (record && (record.sessionEpoch ?? 0) === (req.session.epoch ?? 0)) req.person = await load(record);
          else req.session.personId = null;
        }
        if (!readCookies(req)[CSRF_COOKIE]) res.append('Set-Cookie', csrfCookie(newCsrf()));
      }
      next?.();
    } catch (err) {
      next?.(err);
    }
  }

  /** Refuses cross-site writes from cookie sign-ins and to the sign-in forms (login CSRF). */
  function csrf(req, res, next) {
    if (READS.has(req.method) || req.signedInBy === 'header') return next();
    const formPost = req.path.startsWith('/api/v1/auth/');
    if (!req.person && !formPost) return next();
    const token = readCookies(req)[CSRF_COOKIE];
    const sent = req.get('x-csrf-token') ?? '';
    if (token && sent.length === token.length && crypto.timingSafeEqual(Buffer.from(sent), Buffer.from(token))) return next();
    const origin = req.get('origin') ?? req.get('referer');
    if (origin) {
      try {
        if (new URL(origin).host === req.get('host')) return next();
      } catch { /* not a URL: refuse below */ }
    }
    sendError(res, 403, 'csrf', 'The form expired. Reload the page and try again.');
  }

  /** Signed in, or 401 (API) / a redirect to the sign-in page. */
  function auth(req, res, next) {
    if (req.person) return next();
    if (isApi(req)) return sendError(res, 401, 'unauthenticated', 'Sign in to continue.');
    res.redirect(302, loginUrl(req.originalUrl));
  }

  /** Operators only. Customers get a 404, so the back office is not advertised. */
  function requireOperator(req, res, next) {
    auth(req, res, () => (req.person.operator ? next() : notFound(req, res)));
  }

  /** Platform operators only (nooblyjs-core's /services portal). */
  function requirePlatform(req, res, next) {
    if (READS.has(req.method) && LOGIN_ASSETS.has(req.originalUrl.split('?')[0])) return next();
    auth(req, res, () => (req.person.operator === 'platform' ? next() : notFound(req, res)));
  }

  /**
   * Members of :workspace only; anyone else gets a 404 (product.md §10: nobody can see another workspace). Sets
   * req.workspace ({ id, name, role }). This is the isolation middleware (roadmap 1.6): every workspace route uses it.
   */
  function requireWorkspace(req, res, next) {
    auth(req, res, () => {
      const workspace = req.person.workspaces.find((w) => w.id === req.params.workspace);
      if (!workspace) return notFound(req, res, 'workspace');
      req.workspace = workspace;
      next();
    });
  }

  /** After requireWorkspace: the workspace's Owner only (product.md §7). Members get a 403: they can see the page. */
  function requireOwner(req, res, next) {
    if (req.workspace?.role === 'Owner') return next();
    sendError(res, 403, 'forbidden', 'Only the workspace owner can do this.');
  }

  /** Starts a session for a person (a new session id: no fixation) and issues a fresh CSRF token. */
  function signIn(req, res, record, extra = {}) {
    return new Promise((resolve, reject) => {
      req.session.regenerate((err) => {
        if (err) return reject(err);
        Object.assign(req.session, { personId: record.id, epoch: record.sessionEpoch ?? 0, at: Date.now(), ...extra });
        req.session.save((saveErr) => {
          if (saveErr) return reject(saveErr);
          res.append('Set-Cookie', csrfCookie(newCsrf()));
          resolve();
        });
      });
    });
  }

  function signOut(req, res) {
    return new Promise((resolve) => {
      const done = () => {
        res.append('Set-Cookie', `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secureFlag}`);
        res.append('Set-Cookie', csrfCookie(newCsrf()));
        resolve();
      };
      if (!req.session) return done();
      req.session.destroy(done);
    });
  }

  /** Where a person goes after signing in. */
  // Operators land on the back office even when they have a workspace of their own (core-login decision).
  const homeOf = (person) => (person.operator ? '/admin' : `/w/${person.workspaces[0]?.id ?? ''}`);

  /** The development sign-in (not in production): GET/POST /dev/login. */
  function devRoutes(express) {
    const router = express.Router();
    router.get('/dev/login', async (req, res, next) => {
      try {
        const next_ = safeNext(req.query.next) ?? '';
        const people = await accounts.listPeople();
        const rows = [];
        for (const p of people.sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
          const ws = await accounts.workspacesFor(p.id);
          rows.push(`
        <li class="nj-dev-person">
          <form method="post" action="/dev/login${next_ ? `?next=${encodeURIComponent(next_)}` : ''}">
            <input type="hidden" name="person" value="${escapeHtml(p.id)}">
            <button type="submit" class="btn btn-secondary">${escapeHtml(p.name)}</button>
            <span class="nj-meta">${p.operator ? `Operator · ${escapeHtml(p.operator)}` : escapeHtml(ws.map((w) => `${w.name} · ${w.role}`).join(', ') || p.email)}</span>
          </form>
        </li>`);
        }
        res.type('html').send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sign in · NooblyJS Cloud (development)</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css">
<link rel="stylesheet" href="/css/styles.css"><link rel="stylesheet" href="/css/hero-co.css"></head>
<body class="nj-dev-login"><main class="nj-card nj-dev-card">
<p class="nj-eyebrow">Development sign-in</p><h1>Sign in as</h1>
<p class="lead">Anyone can be anyone here. This page does not exist in production: <a href="${LOGIN_PAGE}">use the real sign-in</a>.</p>
<ul class="nj-dev-people">${rows.join('')}</ul></main></body></html>`);
      } catch (err) {
        next(err);
      }
    });
    router.post('/dev/login', express.urlencoded({ extended: false }), async (req, res, next) => {
      try {
        const record = await accounts.getPerson(String(req.body?.person ?? ''));
        if (!record) return res.status(400).type('text').send('Pick a person.');
        await signIn(req, res, record);
        res.redirect(303, safeNext(req.query.next) ?? homeOf(await load(record)));
      } catch (err) {
        next(err);
      }
    });
    return router;
  }

  return { cookie, identify, csrf, auth, requireOperator, requirePlatform, requireWorkspace, requireOwner, signIn, signOut, homeOf, load, devRoutes, close: store.close };
}
