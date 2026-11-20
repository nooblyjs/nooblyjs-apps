// Phase 2 (roadmap 2.2–2.7) through the API, on the infrastructure accelerator's mock platform and the mock GitHub:
// the owner connects GitHub, a member creates a web service from a repo, the first build's progress lands in our
// deploy records and the live channel, and the service goes Live. Secrets are write-only; another workspace sees
// nothing of it.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { startApp, cookieJar } from './helpers.js';
import { toWorkloadSpec } from '../src/platform/workloads.js';
import { parseDotEnv } from '../src/routes/services.js';
import { mockCommit } from '../src/github/mock-data.js';

let t;
before(async () => { t = await startApp(); });
after(async () => { await t?.close(); });

const WS = '/api/v1/workspaces/exclusivity-life';
const SECRET = 'postgres://app:hunter2-very-secret@db.internal/app';

/** Connects a workspace to the mock GitHub as `login`, the way a browser would. */
async function connectGithub(as, workspace, login) {
  const jar = cookieJar();
  const start = await t.get(`/w/${workspace}/github/connect`, { as, jar });
  assert.equal(start.status, 302, `connect starts (${start.status} ${start.location})`);
  const authorize = new URL(start.location);
  assert.equal(authorize.pathname, '/dev/github/login/oauth/authorize');
  assert.equal(authorize.searchParams.get('scope'), 'repo read:org');
  const user = { 'octo-dev': '1001', stevie: '1002' }[login];
  const granted = await t.post('/dev/github/login/oauth/authorize', { form: { user, redirect_uri: authorize.searchParams.get('redirect_uri'), state: authorize.searchParams.get('state') } });
  const back = new URL(granted.location);
  const done = await t.get(back.pathname + back.search, { as, jar });
  return done;
}

const webService = (over = {}) => ({
  type: 'web', name: 'blog', repo: 'stevie/nooblyjs-blog', branch: 'main', region: 'af-south', runtime: 'node22',
  buildCommand: 'npm ci && npm run build', startCommand: 'npm start', plan: 'standard', instances: 2,
  env: [{ key: 'NODE_ENV', value: 'production' }, { key: 'DATABASE_URL', value: SECRET }], autoDeploy: true, ...over,
});

test('the catalogue: four instance types, five regions (Local network and two clouds open), four runtimes', async () => {
  const c = (await t.get(`${WS}/catalog`, { as: 'stevie' })).json;
  assert.deepEqual(c.plans.map((p) => [p.name, p.cpu, p.memoryMb]), [['Starter', 0.5, 512], ['Standard', 1, 2048], ['Pro', 2, 4096], ['Pro Plus', 4, 8192]]);
  assert.deepEqual(c.regions.map((r) => [r.name, r.available]), [['Local network', true], ['Johannesburg', true], ['Frankfurt', false], ['Virginia', true], ['Singapore', false]]);
  assert.deepEqual(c.runtimes.map((r) => r.name), ['Node.js 22', 'Docker (Dockerfile in repo)', 'Python 3.12', 'Go 1.23']);
});

test('2.2 a service becomes a workload spec: plan → cpu and memory, env as secret references only', () => {
  const spec = toWorkloadSpec({
    id: 'svc_1', workspaceId: 'acme', name: 'api', type: 'web', region: 'af-south', plan: 'pro', instances: 3,
    source: { repo: 'acme/api', branch: 'main', rootDir: 'apps/api' }, build: { runtime: 'go123', buildCommand: '', startCommand: './api' },
    env: [{ key: 'A', sealed: 'v1.x' }], autoDeploy: true,
  }, { appDomain: 'nooblyjs.app', groups: [{ id: 'grp_1', vars: [{ key: 'A' }, { key: 'B' }] }] });
  assert.deepEqual(spec.plan, { cpu: 2, memoryMb: 4096 });
  assert.equal(spec.region, 'af-south-1');
  assert.equal(spec.kind, 'service');
  assert.deepEqual(spec.domains, ['api.nooblyjs.app']);
  assert.deepEqual(spec.run.env, [{ key: 'A', secretRef: 'hero:svc:svc_1:A' }, { key: 'B', secretRef: 'hero:grp:grp_1:B' }], 'the service\'s own A wins over the group\'s');
  assert.equal(JSON.stringify(spec).includes('v1.x'), false);
  assert.equal(spec.build.buildCommand, null);
  assert.deepEqual(toWorkloadSpec({ id: 's', workspaceId: 'a', name: 'w', type: 'worker', region: 'us-east', plan: 'starter', instances: 1, source: { repo: 'a/b', branch: 'main' }, build: { runtime: 'node22' } }, { appDomain: 'x.app' }).domains, []);
});

test('.env text becomes variables; comments, export and quotes are handled', () => {
  assert.deepEqual(parseDotEnv('# c\nexport A=1\nB="two words"\n\nC=\'x=y\'\nbad line\n'), [{ key: 'A', value: '1' }, { key: 'B', value: 'two words' }, { key: 'C', value: 'x=y' }]);
});

test('2.4 before GitHub is connected, creating says so; only the owner connects', async () => {
  const res = await t.post(`${WS}/services`, { as: 'stevie', body: webService() });
  assert.equal(res.status, 422);
  assert.match(res.json.error.details.find((d) => d.path === 'repo').message, /Connect GitHub first/);
  assert.deepEqual((await t.get(`${WS}/github`, { as: 'stevie' })).json.connected, false);

  // A member is sent back with owner-only.
  await t.accounts.addMember('exclusivity-life', 'amara', 'Member');
  const member = await t.get('/w/exclusivity-life/github/connect', { as: 'amara' });
  assert.match(member.location, /error=owner-only/);

  const done = await connectGithub('stevie', 'exclusivity-life', 'stevie');
  assert.equal(done.location, '/w/exclusivity-life/github?connected=1');
  const status = (await t.get(`${WS}/github`, { as: 'stevie' })).json;
  assert.deepEqual([status.connected, status.login, status.organisations], [true, 'stevie', ['exclusivity-life', 'nooblyjs']]);
  assert.equal(JSON.stringify(status).includes('gho_'), false, 'the token is never sent');
  assert.equal((await t.del(`${WS}/github`, { as: 'amara' })).status, 403, 'members cannot disconnect');
  assert.ok(t.host.auditLog.some((r) => r.action === 'github.connected' && r.actor === 'stevie'));
});

test('2.4 repositories (searchable) and branches come from the connection', async () => {
  const all = (await t.get(`${WS}/github/repos`, { as: 'amara' })).json.repos;
  assert.deepEqual(all.map((r) => r.fullName), ['stevie/nooblyjs-blog', 'exclusivity-life/digital-teammates', 'exclusivity-life/software-factory', 'stevie/space-trader', 'exclusivity-life/engx-platform']);
  assert.deepEqual(all.map((r) => r.private), [false, true, true, false, true]);
  assert.deepEqual((await t.get(`${WS}/github/repos?q=TEAM`, { as: 'stevie' })).json.repos.map((r) => r.name), ['digital-teammates']);
  assert.deepEqual((await t.get(`${WS}/github/repos/stevie/nooblyjs-blog/branches`, { as: 'stevie' })).json.branches, ['main', 'develop', 'release/1.4']);
  assert.equal((await t.get(`${WS}/github/repos/someone/else/branches`, { as: 'stevie' })).status, 404);
});

test('2.5 the create form\'s fields are checked, each problem under its field', async () => {
  const res = await t.post(`${WS}/services`, { as: 'stevie', body: webService({ name: 'Blog!', region: 'eu-central', plan: 'huge', instances: 0, rootDir: '../etc', env: [{ key: 'A', value: '1' }, { key: 'A', value: '2' }] }) });
  assert.equal(res.status, 422);
  const byPath = Object.fromEntries(res.json.error.details.map((d) => [d.path, d.message]));
  assert.deepEqual(Object.keys(byPath).sort(), ['env.1.key', 'instances', 'name', 'plan', 'region', 'rootDir']);
  assert.match(byPath.region, /Frankfurt is not open yet\. Choose Local network or Johannesburg or Virginia\./);
  const many = await t.post(`${WS}/services`, { as: 'stevie', body: webService({ instances: 11 }) });
  assert.deepEqual(many.json.error.details, [{ path: 'instances', message: 'Between 1 and 10.' }]);
  const repo = await t.post(`${WS}/services`, { as: 'stevie', body: webService({ repo: 'someone/private' }) });
  assert.match(repo.json.error.details[0].message, /no such repository/);
  const branch = await t.post(`${WS}/services`, { as: 'stevie', body: webService({ branch: 'nope' }) });
  assert.equal(branch.json.error.details[0].path, 'branch');
  assert.equal((await t.post(`${WS}/services`, { as: 'stevie', body: { type: 'postgres' } })).json.error.details[0].path, 'type', 'Postgres is not creatable yet');
});

test('2.5 + 2.7 a member creates a web service: the first build shows progress, then the service is Live', async () => {
  const events = [];
  const stop = t.realtime.subscribe(['exclusivity-life'], (e) => events.push(e));
  const res = await t.post(`${WS}/services`, { as: 'amara', body: webService() });
  assert.equal(res.status, 201, JSON.stringify(res.json));
  assert.equal(res.json.redirect, '/w/exclusivity-life/services/blog');
  const svc = res.json.service;
  assert.deepEqual([svc.status, svc.typeLabel, svc.planName, svc.spec, svc.instances, svc.url, svc.runtimeName, svc.regionName], ['deploying', 'Web Service', 'Standard', '1 CPU · 2 GB', 2, 'https://blog.nooblyjs.app', 'Node.js 22', 'Johannesburg']);
  assert.deepEqual([svc.estimate, svc.sleepsWhenIdle], [{ usd: 5, text: '$5 / mo' }, true], 'Standard is a flat $5; a web service sleeps when idle');
  const commit = mockCommit('stevie/nooblyjs-blog', 'main');
  assert.equal(res.json.deploy.commit, commit.sha);
  assert.equal(res.json.deploy.message, 'Latest on main');
  assert.deepEqual(res.json.deploy.by, { id: 'amara', name: 'Amara' });

  await t.idle();
  stop();
  const page = (await t.get(`${WS}/services/blog`, { as: 'stevie' })).json;
  assert.equal(page.status, 'live');
  assert.equal(page.current.commit, commit.sha);
  assert.equal(page.deploys.length, 1);
  assert.equal(page.deploys[0].status, 'live');
  assert.equal(page.deploys[0].step, 3);
  const statuses = events.filter((e) => e.type === 'deploy' && e.data.deploy).map((e) => e.data.deploy.status);
  assert.ok(statuses.includes('building') && statuses.includes('deploying') && statuses.at(-1) === 'live', statuses.join(' → '));

  const detail = (await t.get(`${WS}/services/blog/deploys/${page.deploys[0].id}`, { as: 'stevie' })).json;
  assert.ok(detail.log.some((l) => /Cloning stevie\/nooblyjs-blog/.test(l.text)));
  assert.ok(detail.log.some((l) => /Started 2 instances/.test(l.text)));
  assert.ok(!detail.log.some((l) => /noobly-install|managed-by/.test(l.text)), 'no platform internals in the customer\'s log');

  // The platform has the workload under the workspace's tenant, with plan and instances from the form.
  const w = await t.platform().workloads.get('exclusivity-life', 'blog');
  assert.deepEqual([w.plan, w.instances, w.domains, w.autoDeploy], [{ cpu: 1, memoryMb: 2048 }, 2, ['blog.nooblyjs.app'], { branch: 'main', webhookSecretRef: null }]);
  assert.deepEqual(w.run.env.map((e) => Object.keys(e).sort()), [['key', 'secretRef'], ['key', 'secretRef']]);
});

test('2.6 secrets never appear in answers or on disk; a reveal needs the name and is audited', async () => {
  for (const url of [`${WS}/services`, `${WS}/services/blog`, `${WS}/services/blog/deploys`]) {
    const res = await t.get(url, { as: 'stevie' });
    assert.equal(res.text.includes('hunter2'), false, url);
    assert.equal(res.text.includes('sealed'), false, url);
  }
  assert.deepEqual((await t.get(`${WS}/services/blog`, { as: 'stevie' })).json.env, [{ key: 'NODE_ENV' }, { key: 'DATABASE_URL' }]);
  const files = await fs.readdir(path.join(t.dataDir), { recursive: true });
  for (const f of files) {
    const full = path.join(t.dataDir, f);
    if ((await fs.stat(full)).isFile()) assert.equal((await fs.readFile(full, 'utf8')).includes('hunter2'), false, `${f} holds no plain secret`);
  }
  assert.equal((await t.post(`${WS}/services/blog/env/DATABASE_URL/reveal`, { as: 'stevie', body: { confirm: 'nope' } })).status, 422);
  const shown = await t.post(`${WS}/services/blog/env/DATABASE_URL/reveal`, { as: 'stevie', body: { confirm: 'blog' } });
  assert.deepEqual(shown.json, { key: 'DATABASE_URL', value: SECRET });
  assert.ok(t.host.auditLog.some((r) => r.action === 'secret.revealed' && r.detail?.key === 'DATABASE_URL'));
});

test('2.6 environment groups: create, link on a new service, change (linked services redeploy), refuse delete while linked', async () => {
  const g = await t.post(`${WS}/env-groups`, { as: 'stevie', body: { name: 'shared', vars: [{ key: 'SENTRY_DSN', value: 'https://key@sentry.example/1' }] } });
  assert.equal(g.status, 201);
  assert.deepEqual(g.json.vars, [{ key: 'SENTRY_DSN' }]);
  assert.equal((await t.post(`${WS}/env-groups`, { as: 'stevie', body: { name: 'Shared' } })).status, 422, 'names are unique');

  const svc = await t.post(`${WS}/services`, { as: 'stevie', body: webService({ type: 'worker', name: 'jobs', repo: 'exclusivity-life/software-factory', env: [], envGroups: [g.json.id], instances: 1 }) });
  assert.equal(svc.status, 201, JSON.stringify(svc.json));
  assert.equal(svc.json.service.url, null, 'a worker has no URL');
  await t.idle();
  let w = await t.platform().workloads.get('exclusivity-life', 'jobs');
  assert.deepEqual(w.run.env, [{ key: 'SENTRY_DSN', secretRef: `hero:grp:${g.json.id}:SENTRY_DSN` }]);
  assert.equal(w.kind, 'worker');

  const changed = await t.call('PUT', `${WS}/env-groups/${g.json.id}`, { as: 'stevie', body: { vars: [{ key: 'SENTRY_DSN' }, { key: 'LOG_LEVEL', value: 'info' }] } });
  assert.deepEqual([changed.status, changed.json.redeploying], [200, ['jobs']]);
  await t.idle();
  w = await t.platform().workloads.get('exclusivity-life', 'jobs');
  assert.deepEqual(w.run.env.map((e) => e.key), ['SENTRY_DSN', 'LOG_LEVEL']);
  const deploys = (await t.get(`${WS}/services/jobs/deploys`, { as: 'stevie' })).json.deploys;
  assert.deepEqual(deploys.map((d) => [d.trigger, d.status]), [['config', 'live'], ['manual', 'superseded']]);
  assert.equal((await t.post(`${WS}/env-groups/${g.json.id}/vars/SENTRY_DSN/reveal`, { as: 'stevie', body: { confirm: 'shared' } })).json.value, 'https://key@sentry.example/1', 'a kept value stays');
  assert.equal((await t.del(`${WS}/env-groups/${g.json.id}`, { as: 'stevie' })).status, 409);
  const list = (await t.get(`${WS}/env-groups`, { as: 'stevie' })).json.groups;
  assert.deepEqual(list.map((x) => [x.name, x.services]), [['shared', ['jobs']]]);
});

test('2.6 changing a service\'s variables keeps unsent values and redeploys', async () => {
  const res = await t.call('PUT', `${WS}/services/blog/env`, { as: 'stevie', body: { env: [{ key: 'DATABASE_URL' }, { key: 'FEATURE_X', value: 'on' }] } });
  assert.deepEqual(res.json, { env: [{ key: 'DATABASE_URL' }, { key: 'FEATURE_X' }], redeploying: true });
  await t.idle();
  assert.equal((await t.post(`${WS}/services/blog/env/DATABASE_URL/reveal`, { as: 'stevie', body: { confirm: 'blog' } })).json.value, SECRET);
  assert.equal((await t.get(`${WS}/services/blog/deploys`, { as: 'stevie' })).json.deploys[0].trigger, 'config');

  // Only a value changes (same keys, so the same references): it still deploys, or the app would keep the old value.
  const before = (await t.get(`${WS}/services/blog/deploys`, { as: 'stevie' })).json.deploys.length;
  const again = await t.call('PUT', `${WS}/services/blog/env`, { as: 'stevie', body: { env: [{ key: 'DATABASE_URL' }, { key: 'FEATURE_X', value: 'off' }] } });
  assert.equal(again.json.redeploying, true);
  await t.idle();
  const after = (await t.get(`${WS}/services/blog/deploys`, { as: 'stevie' })).json.deploys;
  assert.equal(after.length, before + 1);
  assert.deepEqual([after[0].trigger, after[0].message], ['config', 'Environment changed']);
});

test('another workspace sees nothing, and cannot take a name\'s URL', async () => {
  // amara is a member here now; ops-support is in no workspace. Use a fresh person in their own workspace.
  const jar = cookieJar();
  const signup = await t.post('/api/v1/auth/signup', { jar, headers: { origin: t.base }, body: { name: 'Olu', team: 'Olu Co', email: 'olu@example.dev', password: 'a long password 1' } });
  assert.equal(signup.status, 201);
  for (const url of [`${WS}/services`, `${WS}/services/blog`, `${WS}/env-groups`, `${WS}/github`, `${WS}/github/repos`]) {
    const r = await t.get(url, { jar });
    assert.equal(r.status, 404, url);
    assert.doesNotMatch(r.text, /blog|nooblyjs-blog|stevie/);
  }
  await assert.rejects(t.platform().workloads.get('olu-co', 'blog'), (err) => err.code === 'not_found');

  const own = '/api/v1/workspaces/olu-co';
  const headers = { origin: t.base };
  assert.deepEqual((await t.get(`${own}/services`, { jar })).json.services, []);
  // Olu connects their own GitHub (as octo-dev) and tries to take blog.nooblyjs.app.
  const meId = (await t.get('/api/v1/me', { jar })).json.id;
  const done = await connectGithub(meId, 'olu-co', 'octo-dev');
  assert.equal(done.location, '/w/olu-co/github?connected=1');
  const clash = await t.post(`${own}/services`, { jar, headers, body: webService({ repo: 'octo-dev/hello-world', env: [] }) });
  assert.equal(clash.status, 422);
  assert.deepEqual(clash.json.error.details, [{ path: 'name', message: 'blog.nooblyjs.app is taken. Choose another name.' }]);
  assert.deepEqual((await t.get(`${own}/services`, { jar })).json.services, [], 'nothing half-made');
});
