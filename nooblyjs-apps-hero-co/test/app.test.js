// The app shell (roadmap Phase 0 exit check): every product.md §5 route answers, the gates hold, the theme is the
// verbatim NooblyJS theme, the CSP has no unsafe-inline, CSRF refuses cross-site writes, and the live channel says hello.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { startApp, cookieJar } from './helpers.js';
import { ROOT } from '../src/config.js';
import { WORKSPACE_PAGES, SERVICE_TYPES } from '../src/routes/pages.js';

const THEME = path.resolve(ROOT, '..', '..', 'nooblyjs', 'styling', 'styles.css');
let t;
before(async () => { t = await startApp(); });
after(async () => { await t?.close(); });

const isIndex = (res) => res.status === 200 && /text\/html/.test(res.headers.get('content-type')) && res.text.includes('<div id="app"');

test('health answers', async () => {
  const res = await t.get('/health/live');
  assert.equal(res.status, 200);
  assert.deepEqual(res.json, { status: 'ok' });
});

test('every workspace page answers with the app shell for a member', async () => {
  const urls = [
    ...WORKSPACE_PAGES.map((p) => `/w/exclusivity-life${p}`),
    ...SERVICE_TYPES.map((type) => `/w/exclusivity-life/new/${type}`),
    '/w/exclusivity-life/services/api',
  ];
  for (const url of urls) assert.ok(isIndex(await t.get(url, { as: 'stevie' })), url);
});

test('public pages answer for anyone; an unknown service type or path is a 404', async () => {
  assert.ok(isIndex(await t.get('/')));
  const signin = await t.get('/signin?next=/w/x');
  assert.equal(signin.location, `/services/authservice/views/login.html?returnUrl=${encodeURIComponent('/w/x')}`, '/signin is core\'s login page now');
  assert.equal((await t.get('/w/exclusivity-life/new/mainframe', { as: 'stevie' })).status, 404);
  assert.equal((await t.get('/nowhere')).status, 404);
  const api = await t.get('/api/v1/nowhere', { as: 'stevie' });
  assert.equal(api.status, 404);
  assert.equal(api.json.error.code, 'not_found');
});

test('signed-out visitors are sent to sign in; another workspace is a 404, never a 403', async () => {
  const out = await t.get('/w/exclusivity-life/logs');
  assert.equal(out.status, 302);
  assert.equal(out.headers.get('location'), `/services/authservice/views/login.html?returnUrl=${encodeURIComponent('/w/exclusivity-life/logs')}`);
  assert.equal((await t.get('/w/exclusivity-life', { as: 'amara' })).status, 404);
  assert.equal((await t.get('/w/exclusivity-life/settings', { as: 'amara' })).status, 404);
  assert.ok(isIndex(await t.get('/w/amara-labs', { as: 'amara' })));
});

test('/admin is for operators; customers get a 404', async () => {
  assert.equal((await t.get('/admin', { as: 'stevie' })).status, 404);
  assert.ok(isIndex(await t.get('/admin', { as: 'ops-platform' })));
  assert.ok(isIndex(await t.get('/admin', { as: 'ops-support' })));
});

test('/api/v1/me says who is signed in and which workspaces they have', async () => {
  assert.equal((await t.get('/api/v1/me')).status, 401);
  const me = await t.get('/api/v1/me', { as: 'stevie' });
  assert.equal(me.status, 200);
  assert.deepEqual(me.json.workspaces, [{ id: 'exclusivity-life', name: 'Exclusivity Life', role: 'Owner' }]);
  assert.equal(me.json.operator, null);
});

test('the theme is a verbatim copy of nooblyjs/styling/styles.css, loaded with Bootstrap 5.3.3 and Bootstrap Icons 1.11.3', async () => {
  const served = await t.get('/css/styles.css');
  assert.equal(served.status, 200);
  assert.equal(served.text, await fs.readFile(THEME, 'utf8'));
  const index = await t.get('/');
  assert.match(index.text, /bootstrap@5\.3\.3\/dist\/css\/bootstrap\.min\.css/);
  assert.match(index.text, /bootstrap-icons@1\.11\.3/);
  assert.ok(index.text.indexOf('/css/styles.css') < index.text.indexOf('/css/hero-co.css'), 'styles.css before hero-co.css');
  assert.equal((await t.get('/css/hero-co.css')).status, 200);
  assert.match((await t.get('/js/app.js')).headers.get('content-type'), /javascript/);
});

test('the CSP is enforced, allows the theme\'s origins and has no unsafe-inline', async () => {
  const csp = (await t.get('/')).headers.get('content-security-policy');
  assert.ok(csp, 'CSP header');
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /style-src[^;]*https:\/\/cdn\.jsdelivr\.net[^;]*https:\/\/fonts\.googleapis\.com/);
  assert.match(csp, /font-src[^;]*https:\/\/fonts\.gstatic\.com/);
  assert.doesNotMatch(csp, /unsafe-inline/);
});

test('no page or script carries an inline style or handler', async () => {
  const files = ['public/index.html', ...(await fs.readdir(path.join(ROOT, 'public/js'), { recursive: true })).filter((f) => f.endsWith('.js')).map((f) => `public/js/${f}`)];
  for (const file of files) {
    const text = await fs.readFile(path.join(ROOT, file), 'utf8');
    assert.doesNotMatch(text, /\sstyle=["']/, file);
    assert.doesNotMatch(text, /\son[a-z]+=["']/, file);
    assert.doesNotMatch(text, /<style[\s>]/, file);
  }
});

test('the development sign-in starts a session (HttpOnly cookie, fresh CSRF token) and goes home', async () => {
  assert.equal((await t.get('/dev/login')).status, 200);
  const jar = cookieJar();
  const res = await t.post('/dev/login', { jar, form: { person: 'stevie' } });
  assert.equal(res.status, 303);
  assert.equal(res.location, '/w/exclusivity-life');
  const cookies = res.headers.getSetCookie().join('\n');
  assert.match(cookies, /hero\.sid=[^;]+; Path=\/; Expires=[^;]+; HttpOnly; SameSite=Lax/);
  assert.match(cookies, /noobly\.csrf=[\w-]+; Path=\/; SameSite=Lax(?!; HttpOnly)/);
  assert.equal((await t.get('/api/v1/me', { jar })).json.id, 'stevie');
  const ops = await t.post('/dev/login', { form: { person: 'ops-platform' } });
  assert.equal(ops.location, '/admin');
});

test('a cookie sign-in cannot write cross-site: it needs the CSRF token or a same-origin Origin', async () => {
  const jar = cookieJar();
  await t.post('/dev/login', { jar, form: { person: 'ops-platform' } });
  const token = jar.get('noobly.csrf');
  const body = { name: 'CSRF probe' };
  const cross = await t.post('/admin/customer/api/v1/customers', { jar, body, headers: { origin: 'https://evil.example' } });
  assert.equal(cross.status, 403);
  assert.equal(cross.json.error.code, 'csrf');
  assert.equal((await t.post('/admin/customer/api/v1/customers', { jar, body })).json?.error?.code, 'csrf');
  assert.equal((await t.post('/admin/customer/api/v1/customers', { jar, body, headers: { 'x-csrf-token': 'wrong-token-of-any-length' } })).json?.error?.code, 'csrf');
  const withToken = await t.post('/admin/customer/api/v1/customers', { jar, body, headers: { 'x-csrf-token': token } });
  assert.notEqual(withToken.json?.error?.code, 'csrf');
  const sameOrigin = await t.post('/admin/customer/api/v1/customers', { jar, body, headers: { origin: t.base } });
  assert.notEqual(sameOrigin.json?.error?.code, 'csrf');
  // The sign-in forms are covered too (login CSRF), signed in or not.
  const login = await t.post('/services/authservice/api/login', { body: { email: 'a@b.co', password: 'x' }, headers: { origin: 'https://evil.example' } });
  assert.equal(login.status, 403);
  assert.equal((await t.post('/services/authservice/api/login', { body: { email: 'a@b.co', password: 'x' } })).status, 403, 'no Origin or Referer: refused');
});

test('the live channel says hello with the person\'s workspaces', async () => {
  const controller = new AbortController();
  const res = await fetch(`${t.base}/api/v1/events`, { headers: { 'x-dev-person': 'stevie' }, signal: controller.signal });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/event-stream/);
  const reader = res.body.getReader();
  const { value } = await reader.read();
  const first = new TextDecoder().decode(value);
  assert.match(first, /^event: hello\ndata: \{"person":"stevie","topics":\["exclusivity-life"\]\}/);
  controller.abort();
  assert.equal((await t.get('/api/v1/events')).status, 401);
});
