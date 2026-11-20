// Accounts (roadmap 1.1–1.5): sign up with email and with GitHub, each landing in its own workspace with a default
// project and Production; sign in and out; verify email; reset password; the customer, organisation and consent the
// operator sees in the customers accelerator.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, cookieJar } from './helpers.js';
import { checkSignUp, passwordProblem } from '../src/platform/auth.js';
import { slugify } from '../src/platform/accounts.js';

let t;
before(async () => { t = await startApp(); });
after(async () => { await t?.close(); });

const signUp = (jar, body) => t.post('/api/v1/auth/signup', { jar, body, headers: { origin: t.base } });
// Signing in is nooblyjs-core's login page, which posts here (answered by this app).
const LOGIN_API = '/services/authservice/api/login';
const signIn = (jar, body) => t.post(LOGIN_API, { jar, body, headers: { origin: t.base } });
const auth = (jar, path, body) => t.post(`/api/v1/auth/${path}`, { jar, body, headers: { origin: t.base } });
const ada = { name: 'Ada Lovelace', team: 'Analytical Engines', email: 'Ada@Engines.dev', password: 'difference engine 1', marketing: true };

test('the password rule is product.md\'s: 12 or more characters with a number', () => {
  assert.equal(passwordProblem('short1'), 'Use 12 or more characters with a number.');
  assert.equal(passwordProblem('twelve chars'), 'Use 12 or more characters with a number.');
  assert.equal(passwordProblem('twelve chars 1'), null);
  assert.equal(passwordProblem('aaaaaaaaaaa1'), null, 'no upper case or symbol needed');
  assert.deepEqual(checkSignUp({}).details.map((d) => d.path), ['name', 'team', 'email', 'password']);
  assert.equal(slugify('Exclusivity Life'), 'exclusivity-life');
  assert.equal(slugify('Ünïcode & Co.'), 'unicode-co');
  assert.equal(slugify('!'), 'workspace');
});

test('sign-up refuses bad fields with a message per field', async () => {
  const res = await signUp(cookieJar(), { name: 'A', team: '', email: 'not-an-email', password: 'nonumbershere' });
  assert.equal(res.status, 422);
  assert.deepEqual(res.json.error.details, [
    { path: 'team', message: 'Enter your team or company name.' },
    { path: 'email', message: 'Enter a work email like you@company.com.' },
    { path: 'password', message: 'Use 12 or more characters with a number.' },
  ]);
});

test('sign up with email: a person, a workspace named after the team with Default and Production, a session, a verify email', async () => {
  const jar = cookieJar();
  const res = await signUp(jar, ada);
  assert.equal(res.status, 201);
  assert.equal(res.json.redirect, '/w/analytical-engines');
  assert.ok(jar.get('hero.sid'), 'signed in straight away');

  const me = (await t.get('/api/v1/me', { jar })).json;
  assert.equal(me.email, 'ada@engines.dev', 'emails are stored lower case');
  assert.equal(me.emailVerified, false);
  assert.deepEqual(me.workspaces, [{ id: 'analytical-engines', name: 'Analytical Engines', role: 'Owner' }]);

  const ws = (await t.get('/api/v1/workspaces/analytical-engines', { jar })).json;
  assert.equal(ws.projects.length, 1);
  assert.equal(ws.projects[0].name, 'Default');
  assert.deepEqual(ws.projects[0].environments.map((e) => [e.name, e.region, e.regionName]), [['Production', 'af-south', 'Johannesburg']]);
  assert.ok((await t.get('/w/analytical-engines', { jar })).text.includes('<div id="app"'));

  // Verify: the emailed link → the page posts the token once.
  const link = await t.linkFor('ada@engines.dev', /Verify your email/);
  assert.equal(link.pathname, '/verify-email');
  assert.ok((await t.get(link.pathname + link.search)).text.includes('<div id="app"'), 'the link opens a page; a GET changes nothing');
  assert.equal((await t.get('/api/v1/me', { jar })).json.emailVerified, false);
  const verified = await auth(jar, 'verify-email', { token: link.searchParams.get('token') });
  assert.equal(verified.status, 200);
  assert.equal(verified.json.redirect, '/w/analytical-engines');
  assert.equal((await t.get('/api/v1/me', { jar })).json.emailVerified, true);
  assert.equal((await auth(jar, 'verify-email', { token: link.searchParams.get('token') })).status, 400, 'single use');
  assert.ok(t.outbox().some((m) => m.to === 'ada@engines.dev' && m.subject === 'Welcome to NooblyJS Cloud'), 'welcome after verifying');
});

test('one account per email; the same team name gets its own workspace id', async () => {
  const dup = await signUp(cookieJar(), { ...ada, email: 'ADA@engines.dev' });
  assert.equal(dup.status, 422);
  assert.deepEqual(dup.json.error.details, [{ path: 'email', message: 'An account with this email exists. Sign in instead.' }]);
  const other = await signUp(cookieJar(), { ...ada, name: 'Charles Babbage', email: 'charles@engines.dev' });
  assert.equal(other.json.redirect, '/w/analytical-engines-2');
});

test('sign in, wrong password, sign out', async () => {
  const jar = cookieJar();
  const wrong = await signIn(jar, { email: 'ada@engines.dev', password: 'not the password 1' });
  assert.equal(wrong.status, 401);
  assert.deepEqual(wrong.json, { success: false, error: 'Login failed' });
  assert.equal((await signIn(jar, { email: 'nobody@engines.dev', password: 'whatever 12345' })).status, 401, 'the same answer for unknown emails');
  const ok = await signIn(jar, { email: 'ADA@engines.dev', password: ada.password, returnUrl: '/w/analytical-engines/settings' });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.success, true);
  assert.equal(ok.json.redirectUrl, '/w/analytical-engines/settings');
  assert.equal((await signIn(cookieJar(), { email: 'ada@engines.dev', password: ada.password })).json.redirectUrl, '/w/analytical-engines', 'home: the workspace');
  assert.equal((await signIn(cookieJar(), { email: 'ada@engines.dev', password: ada.password, returnUrl: '//evil.example' })).json.redirectUrl, '/w/analytical-engines', 'no open redirect');
  assert.equal((await t.get('/services/authservice/api/auth/check', { jar })).json.authenticated, true);
  assert.equal((await t.get('/api/v1/me', { jar })).status, 200);
  assert.equal((await t.post('/api/v1/auth/signout', { jar, headers: { 'x-csrf-token': jar.get('noobly.csrf') } })).status, 204);
  assert.equal((await t.get('/api/v1/me', { jar })).status, 401);
  assert.ok(t.host.auditLog.some((r) => r.action === 'person.sign-in-failed'), 'failures are audited');
});

test('forgot and reset password: no account enumeration, single-use link, other sessions signed out', async () => {
  const before_ = t.outbox().length;
  assert.equal((await auth(cookieJar(), 'forgot-password', { email: 'nobody@engines.dev' })).status, 202);
  assert.equal(t.outbox().length, before_, 'nothing is sent for an unknown email, and the answer is the same');

  const elsewhere = cookieJar();
  await signIn(elsewhere, { email: 'ada@engines.dev', password: ada.password });
  assert.equal((await auth(cookieJar(), 'forgot-password', { email: 'ada@engines.dev' })).status, 202);
  const link = await t.linkFor('ada@engines.dev', /Reset your NooblyJS Cloud password/);
  assert.equal(link.pathname, '/reset-password');
  const token = link.searchParams.get('token');

  const jar = cookieJar();
  assert.equal((await auth(jar, 'reset-password', { token, password: 'tooshort1' })).status, 422);
  const reset = await auth(jar, 'reset-password', { token, password: 'a brand new password 2' });
  assert.equal(reset.status, 200);
  assert.equal((await t.get('/api/v1/me', { jar })).status, 200, 'signed in by the reset');
  assert.equal((await t.get('/api/v1/me', { jar: elsewhere })).status, 401, 'every other session is signed out');
  assert.equal((await auth(cookieJar(), 'reset-password', { token, password: 'another password 3' })).status, 400, 'single use');
  assert.equal((await signIn(cookieJar(), { email: 'ada@engines.dev', password: ada.password })).status, 401);
  assert.equal((await signIn(cookieJar(), { email: 'ada@engines.dev', password: 'a brand new password 2' })).status, 200);
});

test('the operator sees the new customer, organisation and consent in the customers accelerator', async () => {
  const person = await t.accounts.findPersonByEmail('ada@engines.dev');
  const found = await t.get(`/admin/customer/api/v1/customers/lookup?identity=${encodeURIComponent(`nooblyjs-cloud:${person.id}`)}`, { as: 'ops-platform' });
  assert.equal(found.status, 200);
  const items = found.json.items ?? found.json;
  assert.equal(items.length, 1);
  const customer = items[0];
  assert.equal(customer.id, person.customerId);
  assert.equal(customer.name.full, 'Ada Lovelace');
  // Support agents see the same customer with personal data masked (the customers accelerator's agent role).
  const masked = await t.get(`/admin/customer/api/v1/customers/${customer.id}`, { as: 'ops-support' });
  assert.equal(masked.status, 200);
  assert.notEqual(masked.json.name.full, 'Ada Lovelace');

  const workspace = await t.accounts.getWorkspace('analytical-engines');
  const org = await t.get(`/admin/customer/api/v1/organizations/${workspace.organizationId}`, { as: 'ops-platform' });
  assert.equal(org.json.name, 'Analytical Engines');
  const full = await t.get(`/admin/customer/api/v1/customers/${customer.id}`, { as: 'ops-platform' });
  assert.equal(full.json.organizationId, workspace.organizationId);

  const consent = await t.get(`/admin/customer/api/v1/customers/${customer.id}/consents/state`, { as: 'ops-platform' });
  const marketing = (consent.json.items ?? consent.json).find((c) => c.purpose === 'marketing' && c.channel === 'email');
  assert.equal(marketing.status, 'opt_in');
  assert.equal(marketing.source, 'form');
  const ledger = await t.get(`/admin/customer/api/v1/customers/${customer.id}/consents`, { as: 'ops-platform' });
  const entry = (ledger.json.items ?? ledger.json).find((c) => c.purpose === 'marketing');
  assert.equal(entry.evidence.formId, 'signup-form');
  assert.equal(entry.evidence.text, 'Send me product news and tips by email. You can unsubscribe at any time.');
});

/** Runs the GitHub OAuth dance against the mock, as a browser would. */
async function githubSignIn(jar, userId, query = '') {
  const start = await t.get(`/auth/github${query}`, { jar });
  assert.equal(start.status, 302);
  const authorize = new URL(start.location);
  assert.equal(authorize.pathname, '/dev/github/login/oauth/authorize');
  const back = await t.post('/dev/github/login/oauth/authorize', { jar, form: { user: String(userId), redirect_uri: authorize.searchParams.get('redirect_uri'), state: authorize.searchParams.get('state') } });
  const callback = new URL(back.location);
  assert.equal(callback.pathname, '/auth/github/callback');
  return t.get(callback.pathname + callback.search, { jar });
}

test('sign up with GitHub (passport-github2 against the mock): verified email, own workspace, welcome email', async () => {
  const jar = cookieJar();
  const done = await githubSignIn(jar, 1001, '?marketing=1');
  assert.equal(done.status, 303);
  assert.equal(done.location, '/w/octo-developer');
  const me = (await t.get('/api/v1/me', { jar })).json;
  assert.equal(me.email, 'octo@github-mock.dev');
  assert.equal(me.githubLogin, 'octo-dev');
  assert.equal(me.emailVerified, true, 'GitHub verified the address');
  assert.deepEqual(me.workspaces, [{ id: 'octo-developer', name: 'Octo Developer', role: 'Owner' }]);
  assert.ok(t.outbox().some((m) => m.to === 'octo@github-mock.dev' && m.subject === 'Welcome to NooblyJS Cloud'));
  const person = await t.accounts.findPersonByEmail('octo@github-mock.dev');
  assert.ok(person.customerId, 'linked to a customer');

  // Signing in again is the same person, with no second workspace.
  const again = cookieJar();
  assert.equal((await githubSignIn(again, 1001)).location, '/w/octo-developer');
  assert.equal((await t.get('/api/v1/me', { jar: again })).json.workspaces.length, 1);
});

test('GitHub with the email of an existing account links to it; a forged state is refused', async () => {
  const jar = cookieJar();
  const done = await githubSignIn(jar, 1002); // stevie@exclusivity.life
  assert.equal(done.location, '/w/exclusivity-life');
  const me = (await t.get('/api/v1/me', { jar })).json;
  assert.equal(me.id, 'stevie');
  assert.equal(me.githubLogin, 'stevie');

  const fresh = cookieJar();
  await t.get('/auth/github', { jar: fresh });
  const forged = await t.get('/auth/github/callback?code=anything&state=forged', { jar: fresh });
  assert.equal(forged.status, 303);
  assert.equal(forged.location, '/?error=github');
  assert.equal((await t.get('/api/v1/me', { jar: fresh })).status, 401);
});

test('repeated failed sign-ins are slowed down', async () => {
  let last;
  for (let i = 0; i < 11; i += 1) last = await signIn(cookieJar(), { email: 'charles@engines.dev', password: `wrong password ${i}` });
  assert.equal(last.status, 429);
});

test('no customer link or account email failed along the way', () => {
  assert.deepEqual(t.host.auditLog.filter((r) => ['customers.link-failed', 'email.failed'].includes(r.action)), []);
});
