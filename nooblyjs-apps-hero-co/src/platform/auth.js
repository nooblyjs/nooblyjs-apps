// Accounts and sign-in (roadmap 1.2, 1.3): email + password on nooblyjs-core's authservice, GitHub through passport
// (passport-github2), verify-email and reset-password with single-use tokens, and the sign-up that makes a person, a
// workspace, a default project and a Production environment (product.md §6.1).
//
// Without GITHUB_CLIENT_ID outside production, GitHub is a mock served by this app at /dev/github, so sign-up with
// GitHub works offline and in tests; passport-github2 talks to it exactly as it would to github.com.
import crypto from 'node:crypto';
import path from 'node:path';
import { Passport } from 'passport';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { MOCK_ORGS, MOCK_BRANCHES, mockRepos, mockCommit, mockTokenFor } from '../github/mock-data.js';
import { normaliseEmail } from './accounts.js';
import { safeNext, LOGIN_PAGE, loginUrl } from './session.js';

export const PASSWORD_HINT = 'Use 12 or more characters with a number.';
export const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
export const RESET_TTL_MS = 60 * 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** The product's password rule (product.md §3.1): 12 or more characters with a number. @returns {string|null} */
export function passwordProblem(password) {
  if (typeof password !== 'string' || password.length < 12) return PASSWORD_HINT;
  if (password.length > 256) return 'Use at most 256 characters.';
  if (!/\d/.test(password)) return PASSWORD_HINT;
  return null;
}

const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max + 1) : '');

/** @returns {{ values: object, details: { path: string, message: string }[] }} */
export function checkSignUp(body = {}) {
  const values = {
    name: text(body.name, 100),
    team: text(body.team, 100),
    email: normaliseEmail(text(body.email, 254)),
    password: typeof body.password === 'string' ? body.password : '',
    marketing: body.marketing === true || body.marketing === 'on' || body.marketing === 'true',
    invite: typeof body.invite === 'string' ? body.invite.slice(0, 200) : undefined,
  };
  const details = [];
  if (!values.name) details.push({ path: 'name', message: 'Enter your name.' });
  else if (values.name.length > 100) details.push({ path: 'name', message: 'Use at most 100 characters.' });
  if (!values.team) details.push({ path: 'team', message: 'Enter your team or company name.' });
  else if (values.team.length > 100) details.push({ path: 'team', message: 'Use at most 100 characters.' });
  if (!EMAIL_RE.test(values.email) || values.email.length > 254) details.push({ path: 'email', message: 'Enter a work email like you@company.com.' });
  const pw = passwordProblem(values.password);
  if (pw) details.push({ path: 'password', message: pw });
  return { values, details };
}

/** A small fixed-window limiter (per process; Redis-backed once stack §3.1's production providers land). */
export function createLimiter({ max, windowMs }) {
  const hits = new Map();
  return {
    blocked(key) {
      const h = hits.get(key);
      return Boolean(h && h.resetAt > Date.now() && h.count >= max);
    },
    hit(key) {
      const h = hits.get(key);
      if (!h || h.resetAt <= Date.now()) hits.set(key, { count: 1, resetAt: Date.now() + windowMs });
      else h.count += 1;
      if (hits.size > 10_000) for (const [k, v] of hits) if (v.resetAt <= Date.now()) hits.delete(k);
    },
    clear(key) {
      hits.delete(key);
    },
  };
}

/**
 * nooblyjs-core's authservice (`file` provider under <dataDir>/auth) with the product's password rule.
 * Core's own rule (10+ characters with upper, lower, digit and symbol) differs from product.md's; core has no option
 * for it yet, so the instance's validatePasswordStrength is replaced. [core] candidate: an `options.passwordPolicy`.
 */
export async function createCoreAuth({ serviceRegistry, dataDir }) {
  const core = serviceRegistry.authservice('file', { instanceName: 'nooblyjs-cloud', dataDir: path.join(dataDir, 'auth') });
  core.validatePasswordStrength = async (password) => {
    const problem = passwordProblem(password);
    return { valid: !problem, errors: problem ? [problem] : [] };
  };
  await core.ready;
  return core;
}

const invalid = (res, details) => res.status(422).json({ error: { code: 'invalid', message: 'Check the highlighted fields.', details } });
const sendError = (res, status, code, message) => res.status(status).json({ error: { code, message } });

/**
 * @param {object} o
 * @param {typeof import('express')} o.express
 * @param {ReturnType<import('./session.js').createSession>} o.session
 * @param {ReturnType<import('./accounts.js').createAccounts>} o.accounts
 * @param {object} o.core          createCoreAuth()
 * @param {ReturnType<import('./customers-link.js').createCustomersLink>} o.link
 * @param {{ publicUrl: string, production: boolean, devSignIn: boolean, github: { clientId?: string, clientSecret?: string } }} o.config
 * @param {(entry: object) => Promise<void>} o.audit
 * @param {object} [o.log]
 */
export function createAuth({ express, session, accounts, core, link, config, audit, log }) {
  const url = (p) => `${config.publicUrl}${p}`;
  const githubMock = !config.github?.clientId && !config.production;
  const githubEnabled = Boolean(config.github?.clientId) || githubMock;
  const limits = {
    signinEmail: createLimiter({ max: 10, windowMs: 15 * 60_000 }),
    signinIp: createLimiter({ max: 50, windowMs: 15 * 60_000 }),
    signupIp: createLimiter({ max: 20, windowMs: 60 * 60_000 }),
    emailSend: createLimiter({ max: 5, windowMs: 60 * 60_000 }),
  };
  const tooMany = (res) => sendError(res, 429, 'rate_limited', 'Too many attempts. Wait a few minutes and try again.');

  /** After a person exists: their workspace (unless joining by invitation only), customer link, invitation. */
  async function finishSignUp(person, { team, marketing, invite, source, request }) {
    let workspace = null;
    let joined = null;
    if (invite) {
      const result = await accounts.acceptInvitation(invite, person);
      if (result.ok) {
        joined = result.workspaceId;
        if (!person.emailVerifiedAt) person = await accounts.updatePerson(person.id, { emailVerifiedAt: new Date().toISOString() });
        await audit({ action: 'invitation.accepted', actor: person.id, target: joined });
      }
    }
    if (team || !joined) workspace = await accounts.createWorkspace({ name: team || `${person.name}'s workspace`, ownerId: person.id });
    await link.linkPerson(person, { workspace, marketingConsent: marketing, source, request });
    if (workspace) await audit({ action: 'workspace.created', actor: person.id, target: workspace.id });
    return { person: await accounts.getPerson(person.id), home: `/w/${joined ?? workspace.id}` };
  }

  async function sendVerify(person) {
    const token = await accounts.issueToken('verify', person.id, VERIFY_TTL_MS);
    return link.send('cloud-verify-email', { person, data: { person: { name: person.name }, verifyUrl: url(`/verify-email?token=${token}`) } });
  }

  async function sendWelcome(person) {
    const [first] = await accounts.workspacesFor(person.id);
    return link.send('cloud-welcome', { person, data: { person: { name: person.name }, workspaceUrl: url(first ? `/w/${first.id}` : '/') }, idempotencyKey: `welcome:${person.id}` });
  }

  // ---- /api/v1/auth -----------------------------------------------------------------

  const api = express.Router();
  api.use(express.json({ limit: '16kb' }));

  api.get('/config', (req, res) => res.json({ github: githubEnabled, githubMock, devSignIn: config.devSignIn, passwordHint: PASSWORD_HINT }));

  api.post('/signup', async (req, res, next) => {
    try {
      if (limits.signupIp.blocked(req.ip)) return tooMany(res);
      const { values, details } = checkSignUp(req.body);
      if (details.length) return invalid(res, details);
      limits.signupIp.hit(req.ip);
      if (await accounts.findPersonByEmail(values.email)) {
        return invalid(res, [{ path: 'email', message: 'An account with this email exists. Sign in instead.' }]);
      }
      try {
        await core.createUser({ email: values.email, fullName: values.name, password: values.password, role: 'user' });
      } catch (err) {
        if (!/already exists/i.test(err.message)) throw err;
        // A credential without a person (left by a failed sign-up): replace its password with this one.
        await core.updateUser(values.email, { password: values.password, fullName: values.name });
      }
      const person = await accounts.createPerson({ name: values.name, email: values.email, signedUpWith: 'email' });
      const done = await finishSignUp(person, { team: values.team, marketing: values.marketing, invite: values.invite, source: 'signup-form', request: { ip: req.ip, userAgent: req.get('user-agent') } });
      await audit({ action: 'person.signed-up', actor: person.id, target: person.id, detail: { with: 'email' } });
      if (!done.person.emailVerifiedAt) await sendVerify(done.person);
      else await sendWelcome(done.person);
      const signedIn = await core.authenticateUser(values.email, values.password).catch(() => null);
      await session.signIn(req, res, done.person, { authToken: signedIn?.session?.token });
      res.status(201).json({ redirect: done.home });
    } catch (err) {
      next(err);
    }
  });

  /** Email and password against core's authservice. → { person } or { status, error } */
  async function passwordSignIn(req, res, email, password) {
    if (!email || !password) return { status: 400, error: 'Enter your email and password.' };
    if (limits.signinEmail.blocked(email) || limits.signinIp.blocked(req.ip)) return { status: 429, error: 'Too many attempts. Wait a few minutes and try again.' };
    const person = await accounts.findPersonByEmail(email);
    const result = person ? await core.authenticateUser(email, password).catch(() => null) : null;
    if (!result) {
      limits.signinEmail.hit(email);
      limits.signinIp.hit(req.ip);
      await audit({ action: 'person.sign-in-failed', actor: person?.id ?? null, target: person?.id ?? 'unknown' });
      return { status: 401, error: 'Login failed' };
    }
    limits.signinEmail.clear(email);
    await session.signIn(req, res, person, { authToken: result.session?.token });
    if (!person.customerId) await link.linkPerson(person);
    await audit({ action: 'person.signed-in', actor: person.id, target: person.id, detail: { with: 'email' } });
    return { person: await session.load(person) };
  }

  async function signOut(req, res) {
    const token = req.session?.authToken;
    if (token) await core.logout(token).catch(() => {});
    if (req.person) await audit({ action: 'person.signed-out', actor: req.person.id, target: req.person.id });
    await session.signOut(req, res);
  }

  api.post('/signout', async (req, res, next) => {
    try {
      await signOut(req, res);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  api.post('/verify-email', async (req, res, next) => {
    try {
      const personId = await accounts.consumeToken('verify', req.body?.token);
      if (!personId) return sendError(res, 400, 'invalid_token', 'This link has expired or was already used. Sign in and send a new one.');
      const person = await accounts.updatePerson(personId, { emailVerifiedAt: new Date().toISOString() });
      await audit({ action: 'person.email-verified', actor: personId, target: personId });
      await sendWelcome(person);
      res.json({ verified: true, redirect: req.person?.id === personId ? session.homeOf(req.person) : LOGIN_PAGE });
    } catch (err) {
      next(err);
    }
  });

  api.post('/verify-email/resend', session.auth, async (req, res, next) => {
    try {
      if (req.person.emailVerified) return res.json({ sent: false, verified: true });
      if (limits.emailSend.blocked(`verify:${req.person.id}`)) return tooMany(res);
      limits.emailSend.hit(`verify:${req.person.id}`);
      await sendVerify(await accounts.getPerson(req.person.id));
      res.status(202).json({ sent: true });
    } catch (err) {
      next(err);
    }
  });

  /** Always 202: it never says whether an account exists. */
  api.post('/forgot-password', async (req, res, next) => {
    try {
      const email = normaliseEmail(text(req.body?.email, 254));
      if (!EMAIL_RE.test(email)) return invalid(res, [{ path: 'email', message: 'Enter the email you signed up with.' }]);
      const person = await accounts.findPersonByEmail(email);
      if (person && !limits.emailSend.blocked(`reset:${email}`)) {
        limits.emailSend.hit(`reset:${email}`);
        const token = await accounts.issueToken('reset', person.id, RESET_TTL_MS);
        await link.send('cloud-password-reset', { person, data: { person: { name: person.name }, resetUrl: url(`/reset-password?token=${token}`) } });
        await audit({ action: 'person.reset-requested', actor: null, target: person.id });
      }
      res.status(202).json({ sent: true });
    } catch (err) {
      next(err);
    }
  });

  api.post('/reset-password', async (req, res, next) => {
    try {
      const problem = passwordProblem(req.body?.password);
      if (problem) return invalid(res, [{ path: 'password', message: problem }]);
      const personId = await accounts.consumeToken('reset', req.body?.token);
      if (!personId) return sendError(res, 400, 'invalid_token', 'This link has expired or was already used. Ask for a new one.');
      const person = await accounts.getPerson(personId);
      try {
        await core.updateUser(person.email, { password: req.body.password });
      } catch (err) {
        if (!/not found/i.test(err.message)) throw err;
        await core.createUser({ email: person.email, fullName: person.name, password: req.body.password, role: 'user' });
      }
      // A reset proves the email address, and signs out every other session.
      const updated = await accounts.updatePerson(personId, { sessionEpoch: (person.sessionEpoch ?? 0) + 1, emailVerifiedAt: person.emailVerifiedAt ?? new Date().toISOString() });
      await audit({ action: 'person.password-reset', actor: personId, target: personId });
      const signedIn = await core.authenticateUser(person.email, req.body.password).catch(() => null);
      await session.signIn(req, res, updated, { authToken: signedIn?.session?.token });
      res.json({ redirect: session.homeOf(await session.load(updated)) });
    } catch (err) {
      next(err);
    }
  });

  // ---- GitHub (passport-github2) ------------------------------------------------------

  const pages = express.Router();
  const passport = new Passport();
  const githubBase = githubMock ? url('/dev/github') : null;
  if (githubEnabled) {
    passport.use(new GitHubStrategy({
      clientID: config.github?.clientId ?? 'mock-client-id',
      clientSecret: config.github?.clientSecret ?? 'mock-client-secret',
      callbackURL: url('/auth/github/callback'),
      scope: ['read:user', 'user:email'],
      allRawEmails: true,
      state: true,
      ...(githubMock ? {
        authorizationURL: `${githubBase}/login/oauth/authorize`,
        tokenURL: `${githubBase}/login/oauth/access_token`,
        userProfileURL: `${githubBase}/api/user`,
        userEmailURL: `${githubBase}/api/user/emails`,
      } : {}),
    }, (accessToken, refreshToken, profile, done) => done(null, profile)));
  }
  pages.use(passport.initialize());

  pages.get('/auth/github', (req, res, next) => {
    if (!githubEnabled) return res.status(404).type('text').send('GitHub sign-in is not configured.');
    req.session.githubIntent = { next: safeNext(req.query.next), invite: typeof req.query.invite === 'string' ? req.query.invite.slice(0, 200) : undefined, marketing: req.query.marketing === '1' };
    passport.authenticate('github', { session: false })(req, res, next);
  });

  pages.get('/auth/github/callback', (req, res, next) => {
    if (!githubEnabled) return res.status(404).type('text').send('Not found.');
    passport.authenticate('github', { session: false }, async (err, profile) => {
      try {
        if (err || !profile) {
          log?.warn?.(`[hero-co] GitHub sign-in failed: ${err?.message ?? 'no profile'}`);
          return res.redirect(303, '/?error=github');
        }
        const intent = req.session.githubIntent ?? {};
        delete req.session.githubIntent;
        const emails = (profile.emails ?? []).filter((e) => e.verified !== false);
        const email = normaliseEmail((emails.find((e) => e.primary) ?? emails[0])?.value);
        if (!email) return res.redirect(303, '/?error=github-email');

        let person = await accounts.findPersonByGithub(profile.id);
        let home = null;
        let created = false;
        if (!person) {
          person = await accounts.findPersonByEmail(email);
          if (person) {
            // GitHub has verified this address, so the accounts are the same person.
            person = await accounts.updatePerson(person.id, { githubId: profile.id, githubLogin: profile.username, emailVerifiedAt: person.emailVerifiedAt ?? new Date().toISOString() });
            await audit({ action: 'person.github-linked', actor: person.id, target: person.id, detail: { login: profile.username } });
          } else {
            const name = profile.displayName || profile.username;
            try {
              await core.createUser({ email, fullName: name, password: `${crypto.randomBytes(24).toString('base64url')}9`, role: 'user' });
            } catch (e) {
              if (!/already exists/i.test(e.message)) throw e;
            }
            person = await accounts.createPerson({ name, email, emailVerified: true, githubId: profile.id, githubLogin: profile.username, signedUpWith: 'github' });
            const done = await finishSignUp(person, { team: intent.invite ? undefined : (profile.displayName || profile.username), marketing: intent.marketing, invite: intent.invite, source: 'signup-github', request: { ip: req.ip, userAgent: req.get('user-agent') } });
            person = done.person;
            home = done.home;
            created = true;
            await audit({ action: 'person.signed-up', actor: person.id, target: person.id, detail: { with: 'github', login: profile.username } });
            await sendWelcome(person);
          }
        }
        if (!created && intent.invite) {
          const result = await accounts.acceptInvitation(intent.invite, person);
          if (result.ok) home = `/w/${result.workspaceId}`;
        }
        await session.signIn(req, res, person, { github: profile.username });
        if (!person.customerId) await link.linkPerson(person);
        if (!created) await audit({ action: 'person.signed-in', actor: person.id, target: person.id, detail: { with: 'github' } });
        res.redirect(303, intent.next ?? home ?? session.homeOf(await session.load(person)));
      } catch (e) {
        next(e);
      }
    })(req, res, next);
  });

  // ---- nooblyjs-core's login page (the only sign-in screen) --------------------------
  // Mounted ahead of core and of the /services gate: the page itself is core's, the answers are this app's, so a
  // sign-in makes a hero-co session (session epoch, rate limits, audit, customer link) and lands on returnUrl or home.
  const A = '/services/authservice';
  const login = express.Router();
  const sameSite = (req) => {
    const from = req.get('origin') ?? req.get('referer');
    try {
      return Boolean(from) && new URL(from).host === req.get('host');
    } catch {
      return false;
    }
  };
  login.get('/signin', (req, res) => res.redirect(302, loginUrl(req.query.next)));
  // "Create New Account" on the login page: sign-up is the marketing page.
  login.get(`${A}/views/request-invitation.html`, (req, res) => res.redirect(302, '/'));
  login.get(`${A}/api/branding`, (req, res) => res.json({
    success: true,
    data: { appName: 'NooblyJS Cloud', logoUrl: '/images/nooblyjs-logo.png', stylesheetUrl: null, homeUrl: req.person ? session.homeOf(req.person) : '/' },
  }));
  login.get(`${A}/api/sso-config`, (req, res) => res.json({ success: true, data: { enabled: false, provider: null, initiateUrl: null } }));
  // Core's meaning: signed in with a live core session (req.session.authToken, which core's /services gate checks).
  // A hero-co session whose core session has expired is asked for the password again, rather than sent round in a loop.
  login.get(`${A}/api/auth/check`, async (req, res) => {
    const token = req.session?.authToken;
    const live = Boolean(req.person && token) && Boolean(await core.validateSession(token).catch(() => null));
    res.json({ success: true, authenticated: live });
  });
  login.post(`${A}/api/login`, express.json({ limit: '16kb' }), async (req, res, next) => {
    try {
      // Login CSRF: the form posts from this site only.
      if (!sameSite(req)) return res.status(403).json({ success: false, error: 'Sign in from the NooblyJS Cloud sign-in page.' });
      const email = normaliseEmail(text(req.body?.email, 254));
      const password = typeof req.body?.password === 'string' ? req.body.password.slice(0, 1024) : '';
      const out = await passwordSignIn(req, res, email, password);
      if (out.error) return res.status(out.status).json({ success: false, error: out.error });
      const p = out.person;
      res.json({
        success: true,
        message: 'Login successful',
        data: { user: { id: p.id, name: p.name, email: p.email } },
        redirectUrl: safeNext(req.body?.returnUrl) ?? session.homeOf(p),
      });
    } catch (err) {
      next(err);
    }
  });
  login.all(`${A}/api/logout`, async (req, res, next) => {
    try {
      if (req.method !== 'GET' && req.person && !sameSite(req)) return res.status(403).json({ success: false, error: 'Sign out from this site.' });
      await signOut(req, res);
      if (req.method === 'GET') return res.redirect(302, LOGIN_PAGE);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  return { api, pages, login, githubMock };
}

/**
 * A stand-in for github.com's OAuth web flow and the two API calls passport-github2 makes (development and tests
 * only). The authorize page lists GITHUB_MOCK_USERS; anyone can be anyone.
 */
export const GITHUB_MOCK_USERS = [
  { id: 1001, login: 'octo-dev', name: 'Octo Developer', email: 'octo@github-mock.dev' },
  { id: 1002, login: 'stevie', name: 'Stevie', email: 'stevie@exclusivity.life' },
  { id: 1003, login: 'no-name', name: null, email: 'no-name@github-mock.dev' },
];

export function githubMockRoutes(express) {
  const router = express.Router();
  const codes = new Map();
  const tokens = new Map();
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const userFor = (req) => {
    const token = String(req.get('authorization') ?? '').replace(/^(bearer|token)\s+/i, '');
    return tokens.get(token) ?? GITHUB_MOCK_USERS.find((u) => mockTokenFor(u.login) === token);
  };

  router.get('/login/oauth/authorize', (req, res) => {
    const { redirect_uri: redirect, state = '' } = req.query;
    const rows = GITHUB_MOCK_USERS.map((u) => `<li class="nj-dev-person"><form method="post" action="/dev/github/login/oauth/authorize">
      <input type="hidden" name="redirect_uri" value="${esc(redirect)}"><input type="hidden" name="state" value="${esc(state)}">
      <input type="hidden" name="user" value="${u.id}"><button class="btn btn-secondary" type="submit">${esc(u.login)}</button>
      <span class="nj-meta">${esc(u.email)}</span></form></li>`).join('');
    res.type('html').send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mock GitHub · authorize</title><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css">
<link rel="stylesheet" href="/css/styles.css"><link rel="stylesheet" href="/css/hero-co.css"></head>
<body class="nj-dev-login"><main class="nj-card nj-dev-card"><p class="nj-eyebrow">Mock GitHub (development)</p>
<h1>Authorize NooblyJS Cloud</h1><p class="lead">Sign in to GitHub as:</p><ul class="nj-dev-people">${rows}</ul></main></body></html>`);
  });

  router.post('/login/oauth/authorize', express.urlencoded({ extended: false }), (req, res) => {
    const user = GITHUB_MOCK_USERS.find((u) => String(u.id) === req.body.user);
    const redirect = String(req.body.redirect_uri ?? '');
    if (!user || !/^https?:\/\//.test(redirect)) return res.status(400).type('text').send('Bad request.');
    const code = crypto.randomBytes(12).toString('hex');
    codes.set(code, user);
    const to = new URL(redirect);
    to.searchParams.set('code', code);
    to.searchParams.set('state', String(req.body.state ?? ''));
    res.redirect(302, to.toString());
  });

  router.post('/login/oauth/access_token', express.urlencoded({ extended: false }), express.json(), (req, res) => {
    const user = codes.get(req.body?.code);
    codes.delete(req.body?.code);
    if (!user) return res.status(400).json({ error: 'bad_verification_code' });
    const token = `gho_${crypto.randomBytes(16).toString('hex')}`;
    tokens.set(token, user);
    res.json({ access_token: token, token_type: 'bearer', scope: 'read:user,user:email' });
  });

  router.get('/api/user', (req, res) => {
    const u = userFor(req);
    if (!u) return res.status(401).json({ message: 'Bad credentials' });
    res.json({ id: u.id, login: u.login, name: u.name, email: null, html_url: `https://github.com/${u.login}` });
  });

  router.get('/api/user/emails', (req, res) => {
    const u = userFor(req);
    if (!u) return res.status(401).json({ message: 'Bad credentials' });
    res.json([{ email: u.email, primary: true, verified: true, visibility: 'private' }]);
  });

  // Repository access (roadmap 2.4): organisations, repositories, branches and a branch's latest commit.
  const signedIn = (req, res) => {
    const u = userFor(req);
    if (!u) res.status(401).json({ message: 'Bad credentials' });
    return u;
  };
  const visible = (u, owner, name) => mockRepos(u.login).find((r) => r.owner === owner && r.name === name);
  router.get('/api/user/orgs', (req, res) => {
    const u = signedIn(req, res);
    if (u) res.json((MOCK_ORGS[u.login] ?? []).map((login) => ({ login })));
  });
  router.get('/api/user/repos', (req, res) => {
    const u = signedIn(req, res);
    if (u) {
      res.json(mockRepos(u.login).map((r) => ({
        name: r.name, full_name: `${r.owner}/${r.name}`, owner: { login: r.owner }, private: r.private, language: r.language, pushed_at: r.pushedAt, default_branch: 'main',
      })));
    }
  });
  router.get('/api/repos/:owner/:repo/branches', (req, res) => {
    const u = signedIn(req, res);
    if (!u) return;
    if (!visible(u, req.params.owner, req.params.repo)) return res.status(404).json({ message: 'Not Found' });
    res.json(MOCK_BRANCHES.map((name) => ({ name })));
  });
  router.get('/api/repos/:owner/:repo/commits/:ref', (req, res) => {
    const u = signedIn(req, res);
    if (!u) return;
    if (!visible(u, req.params.owner, req.params.repo) || !MOCK_BRANCHES.includes(req.params.ref)) return res.status(404).json({ message: 'Not Found' });
    const c = mockCommit(`${req.params.owner}/${req.params.repo}`, req.params.ref);
    res.json({ sha: c.sha, commit: { message: c.message } });
  });

  return router;
}
