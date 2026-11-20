// Workspace isolation (roadmap 1.6; product.md §10: no customer can see, reach or affect another workspace). Started in
// Phase 1 and extended every phase: it walks every route of the workspace API router and every workspace page, so a
// route added later is covered without editing this file. A non-member must get a 404 (never a 403, never data).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import express from 'express';
import { startApp, cookieJar } from './helpers.js';
import { createWorkspacesApi } from '../src/routes/workspaces.js';
import { WORKSPACE_PAGES, SERVICE_TYPES } from '../src/routes/pages.js';

let t;
before(async () => { t = await startApp(); });
after(async () => { await t?.close(); });

/** Every route of the workspace API router: [method, path]. */
function workspaceRoutes() {
  const noop = (req, res, next) => next();
  const router = createWorkspacesApi({ express, session: { requireWorkspace: noop, requireOwner: noop, auth: noop }, accounts: {}, link: {}, config: {}, audit: async () => {}, realtime: {} });
  const out = [];
  for (const layer of router.stack) {
    if (!layer.route) continue;
    for (const method of Object.keys(layer.route.methods)) out.push([method.toUpperCase(), layer.route.path]);
  }
  return out.filter(([, p]) => p.includes(':workspace'));
}

test('the walk finds the workspace API (so the checks below are not vacuous)', () => {
  const routes = workspaceRoutes();
  assert.ok(routes.length >= 6, `found ${routes.length}`);
  assert.ok(routes.some(([m, p]) => m === 'DELETE' && p.endsWith('/members/:person')));
});

test('a signed-up stranger reaches nothing of another workspace: every API route and every page is a 404', async () => {
  const jar = cookieJar();
  const res = await t.post('/api/v1/auth/signup', { jar, headers: { origin: t.base }, body: { name: 'Mallory', team: 'Mallory Inc', email: 'mallory@evil.example', password: 'let me in please 1' } });
  assert.equal(res.status, 201);
  const csrf = { origin: t.base };

  for (const [method, path] of workspaceRoutes()) {
    const url = `/api/v1${path.replace(':workspace', 'exclusivity-life').replace(/:[a-z]+/g, 'x')}`;
    const r = await t.call(method, url, { jar, headers: csrf, ...(method === 'GET' || method === 'DELETE' ? {} : { body: { name: 'pwned', email: 'mallory@evil.example' } }) });
    assert.equal(r.status, 404, `${method} ${url} → ${r.status}`);
    assert.doesNotMatch(r.text, /Exclusivity Life|stevie/i, `${method} ${url} leaks nothing`);
  }

  const pages = [...WORKSPACE_PAGES.map((p) => `/w/exclusivity-life${p}`), ...SERVICE_TYPES.map((s) => `/w/exclusivity-life/new/${s}`), '/w/exclusivity-life/services/api'];
  for (const url of pages) assert.equal((await t.get(url, { jar })).status, 404, url);

  // A workspace that does not exist looks the same as one that does.
  assert.equal((await t.get('/api/v1/workspaces/does-not-exist', { jar })).status, 404);
  assert.deepEqual((await t.get('/api/v1/workspaces/does-not-exist', { jar })).json, (await t.get('/api/v1/workspaces/exclusivity-life', { jar })).json);

  // Nothing changed.
  assert.equal((await t.accounts.getWorkspace('exclusivity-life')).name, 'Exclusivity Life');
  assert.deepEqual((await t.accounts.membersOf('exclusivity-life')).map((m) => m.personId), ['stevie']);
});

test('signed out, the workspace API is a 401 and the pages send you to sign in', async () => {
  for (const [method, path] of workspaceRoutes()) {
    const url = `/api/v1${path.replace(':workspace', 'exclusivity-life').replace(/:[a-z]+/g, 'x')}`;
    const r = await t.call(method, url, { headers: { origin: t.base }, ...(method === 'GET' || method === 'DELETE' ? {} : { body: {} }) });
    assert.equal(r.status, 401, `${method} ${url}`);
  }
  assert.match((await t.get('/w/exclusivity-life/settings')).location, /^\/services\/authservice\/views\/login\.html\?returnUrl=/);
});

test('operators are not workspace members: the back office does not open customer workspaces', async () => {
  assert.equal((await t.get('/w/exclusivity-life', { as: 'ops-platform' })).status, 404);
  assert.equal((await t.get('/api/v1/workspaces/exclusivity-life', { as: 'ops-support' })).status, 404);
});

test('customers cannot reach nooblyjs-core\'s /services portal; only its login page and that page\'s files are open', async () => {
  for (const url of ['/services/', '/services/authservice/api/status', '/services/authservice/views/register.html', '/services/authservice/api/users', '/services/authservice/views/profile.html']) {
    assert.equal((await t.get(url, { as: 'stevie' })).status, 404, url);
  }
  assert.equal((await t.get('/services/', { as: 'ops-support' })).status, 404, 'support operators neither');
  for (const url of ['/services/authservice/views/login.html', '/services/authservice/views/js/login.page.js', '/services/css/auth-login.css', '/images/nooblyjs-logo.png']) {
    assert.equal((await t.get(url)).status, 200, `${url} is open signed out`);
  }
  assert.equal((await t.get('/services/authservice/views/request-invitation.html')).location, '/', 'Create New Account is the sign-up page');
  const branding = (await t.get('/services/authservice/api/branding')).json.data;
  assert.deepEqual([branding.appName, branding.homeUrl], ['NooblyJS Cloud', '/']);
  assert.equal((await t.get('/services/authservice/api/sso-config')).json.data.enabled, false);
  assert.equal((await t.get('/services/authservice/api/auth/check')).json.authenticated, false);
});

test('core\'s login page sends customers to their workspace and operators to /admin', async () => {
  for (const [who, home] of [['stevie', '/w/exclusivity-life'], ['ops-platform', '/admin']]) {
    const person = await t.accounts.getPerson(who);
    const res = await t.post('/services/authservice/api/login', { body: { email: person.email, password: 'development-only-1' }, headers: { origin: t.base } });
    assert.equal(res.status, 200, who);
    assert.equal(res.json.redirectUrl, home, who);
  }
  assert.match((await t.get('/infrastructure/')).location, /^\/services\/authservice\/views\/login\.html\?returnUrl=%2Finfrastructure/);
});

test('core\'s start-up admin (INITIAL_ADMIN_PASSWORD.txt) signs in on the login page as a platform operator', async () => {
  const file = await fs.readFile(path.join(t.dataDir, 'auth', 'INITIAL_ADMIN_PASSWORD.txt'), 'utf8');
  const [, email] = /email:\s*(\S+)/.exec(file);
  const [, password] = /password:\s*(\S+)/.exec(file);
  const jar = cookieJar();
  const res = await t.post('/services/authservice/api/login', { jar, body: { email, password }, headers: { origin: t.base } });
  assert.equal(res.status, 200);
  assert.equal(res.json.redirectUrl, '/admin');
  const me = (await t.get('/api/v1/me', { jar })).json;
  // Operators land on /admin; the start-up admin also has a workspace of their own to deploy into (decided 2026-11-20).
  assert.deepEqual([me.email, me.operator, me.workspaces.length], [email, 'platform', 1]);
  assert.equal((await t.get('/admin', { jar })).status, 200);

  // The same sign-in opens nooblyjs-core's /services portal: core sees its own session token (req.session.authToken).
  const portal = await t.get('/services/', { jar, headers: { accept: 'text/html' } });
  assert.equal(portal.status, 200);
  assert.doesNotMatch(portal.text, /Checking authentication/);
  assert.equal((await t.get('/services/authservice/api/auth/check', { jar })).json.authenticated, true);
});
