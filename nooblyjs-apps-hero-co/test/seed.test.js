// Phase 2's exit check (roadmap 2.8): after the seed, exclusivity-life has its services, deploys and a GitHub
// connection; Stevie creates a web service from a seeded repo, its build runs to Live, and another workspace cannot see
// the workload.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApp } from './helpers.js';

let t;
before(async () => { t = await startApp({ seed: true }); });
after(async () => { await t?.close(); });

const WS = '/api/v1/workspaces/exclusivity-life';

test('the seed: services for the six workloads plus the database and cache, their deploys, GitHub as stevie', async () => {
  await t.idle();
  const { services } = (await t.get(`${WS}/services`, { as: 'stevie' })).json;
  assert.deepEqual(services.map((s) => [s.name, s.type]), [
    ['agents', 'worker'], ['api', 'web'], ['cache', 'keyvalue'], ['database', 'postgres'], ['etl', 'cron'], ['orders', 'worker'], ['records', 'private'], ['storefront', 'static'],
  ]);
  const api = (await t.get(`${WS}/services/api`, { as: 'stevie' })).json;
  assert.deepEqual([api.planName, api.instances, api.url, api.regionName, api.current.commit], ['Standard', 2, 'https://api-exclusivity.nooblyjs.app', 'Johannesburg', 'a1f3c9e']);
  assert.ok(api.deploys.length >= 2);
  assert.deepEqual(api.env.map((e) => e.key), ['NODE_ENV']);
  const github = (await t.get(`${WS}/github`, { as: 'stevie' })).json;
  assert.deepEqual([github.connected, github.login], [true, 'stevie']);
  assert.equal((await t.seedRecords()).skipped, 'already seeded', 'seeding twice changes nothing');
  assert.equal((await t.get(`${WS}/services`, { as: 'stevie' })).json.services.length, 8);
});

test('exit check: create a web service from a seeded repo → build progress → Live; amara-labs sees none of it', async () => {
  const events = [];
  const stop = t.realtime.subscribe(['exclusivity-life'], (e) => events.push(e));
  const res = await t.post(`${WS}/services`, {
    as: 'stevie',
    body: { type: 'web', name: 'teammates', repo: 'exclusivity-life/digital-teammates', branch: 'main', region: 'af-south', runtime: 'node22', plan: 'starter', instances: 1, env: [] },
  });
  assert.equal(res.status, 201, JSON.stringify(res.json));
  await t.idle();
  stop();
  const steps = events.filter((e) => e.data?.service === 'teammates' && e.data.deploy).map((e) => e.data.deploy.status);
  assert.ok(steps.includes('building') && steps.at(-1) === 'live', steps.join(' → '));
  assert.equal((await t.get(`${WS}/services/teammates`, { as: 'stevie' })).json.status, 'live');

  assert.equal((await t.get(`${WS}/services/teammates`, { as: 'amara' })).status, 404);
  assert.deepEqual((await t.get('/api/v1/workspaces/amara-labs/services', { as: 'amara' })).json.services, []);
  await assert.rejects(t.platform().workloads.get('amara-labs', 'teammates'), (err) => err.code === 'not_found');
});

test('reset seeding replaces the services', async () => {
  const result = await t.seedRecords({ reset: true });
  assert.equal(result.services >= 8, true);
  const names = (await t.get(`${WS}/services`, { as: 'stevie' })).json.services.map((s) => s.name);
  assert.equal(names.filter((n) => n === 'api').length, 1);
});
