// The accelerators mounted with mount() (roadmap 0.3): operators reach the infrastructure accelerator (in the
// nooblyjs-core frame) and the customers accelerator; customers reach neither; payments is reported as pending.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApp } from './helpers.js';

let t;
before(async () => { t = await startApp(); });
after(async () => { await t?.close(); });

test('operators reach the infrastructure accelerator: its API, its pages in the frame, the operator shell', async () => {
  const about = await t.get('/infrastructure/api/v1/about', { as: 'ops-platform' });
  assert.equal(about.status, 200);
  assert.deepEqual([about.json.name, about.json.mountPath, about.json.providers], ['infrastructure', '/infrastructure', ['mock']]);
  const page = await t.get('/infrastructure/vms', { as: 'ops-platform' });
  assert.equal(page.status, 200);
  assert.match(page.text, /<!doctype html>/i);
  const shell = await t.get('/api/v1/shell', { as: 'ops-platform' });
  assert.equal(shell.status, 200);
  assert.ok(shell.json.apps.some((a) => a.name === 'infrastructure' && a.mountPath === '/infrastructure'));
  assert.equal((await t.get('/ui/js/api.js')).status, 200);
});

test('the infrastructure accelerator sees operators with their access roles', async () => {
  const owner = await t.get('/infrastructure/api/v1/accounts', { as: 'ops-platform' });
  assert.equal(owner.status, 200);
  const viewer = await t.post('/infrastructure/api/v1/accounts', { as: 'ops-support', body: { cloud: 'gcp', name: 'nope' } });
  assert.equal(viewer.status, 403, 'support (Viewer) may not connect cloud accounts');
  assert.ok(t.host.auditLog.some((r) => r.action === 'access.refused' && r.actor === 'ops-support'), 'the refusal is audited');
});

test('operators reach the customers accelerator\'s API and admin UI', async () => {
  const health = await t.get('/admin/customer/api/v1/health', { as: 'ops-platform' });
  assert.equal(health.status, 200);
  assert.equal(health.json.status, 'ok');
  assert.equal((await t.get('/admin/customer/', { as: 'ops-platform' })).status, 200);
  const list = await t.get('/admin/customer/api/v1/customers?limit=1', { as: 'ops-platform' });
  assert.equal(list.status, 200);
  assert.ok(list.json.total > 0, 'the demo customers are seeded in development');
});

test('customers reach neither accelerator, nor the operator API', async () => {
  for (const url of ['/infrastructure/', '/infrastructure/api/v1/about', '/admin/customer/', '/admin/customer/api/v1/health', '/api/v1/admin/accelerators', '/api/v1/shell']) {
    assert.equal((await t.get(url, { as: 'stevie' })).status, 404, url);
  }
  assert.equal((await t.get('/infrastructure/api/v1/about')).status, 401, 'signed out: 401 on the API');
});

test('the customers accelerator\'s public marketing routes need no sign-in', async () => {
  const res = await t.get('/admin/marketing/p/u/not-a-token');
  assert.notEqual(res.status, 302);
  assert.notEqual(res.status, 401);
});

test('the admin page lists customers and infrastructure as mounted and payments as pending', async () => {
  const res = await t.get('/api/v1/admin/accelerators', { as: 'ops-platform' });
  assert.equal(res.status, 200);
  const byName = Object.fromEntries(res.json.items.map((a) => [a.name, a]));
  assert.equal(byName.customers.state, 'mounted');
  assert.equal(byName.infrastructure.state, 'mounted');
  assert.equal(byName.payments.state, 'pending');
  assert.match(byName.payments.reason, /roadmap Phase 0/);
});

test('infrastructure events reach the shared EventEmitter (mount() mirrors them)', async () => {
  const seen = [];
  const { mounted } = t.accelerators;
  assert.ok(mounted.infrastructure.shutdown, 'the description has shutdown()');
  const listener = (payload) => seen.push(payload);
  // Connecting an account emits infrastructure.account.connected once the mock cloud has made its network.
  const emitter = t.eventEmitter;
  emitter.on('infrastructure.account.connected', listener);
  const res = await t.post('/infrastructure/api/v1/accounts', {
    as: 'ops-platform',
    body: { cloud: 'gcp', name: 'hero-dev', projectId: 'hero-dev-1', defaultRegion: 'europe-west2', credentials: JSON.stringify({ type: 'service_account', project_id: 'hero-dev', private_key: '-----BEGIN PRIVATE KEY-----\nMIIE\n-----END PRIVATE KEY-----\n' }) },
  });
  assert.equal(res.status, 202);
  await mounted.infrastructure.idle();
  emitter.off('infrastructure.account.connected', listener);
  assert.equal(seen.length, 1);
  assert.equal(seen[0].name, 'hero-dev');
});
