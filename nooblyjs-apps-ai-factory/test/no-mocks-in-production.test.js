// Phase 27 (no mocks in production): a production NooblyJS never answers with a mock, and the development tools
// (D10: they stay for development and are refused in production) are absent. Each rule here is a refusal test.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { startApp } from './helpers.js';
import { activeModel } from '../src/routes/platform.js';

const PRODUCTION = { NODE_ENV: 'production', NOOBLY_DEV_LOGIN: 'false', SESSION_SECRET: 'p'.repeat(48), AI_PROVIDER: '' };

let app;
before(async () => { app = await startApp({ env: PRODUCTION }); });
after(() => app?.stop());

test('app.js refuses to start in production with AI_PROVIDER=mock, and says what is allowed', () => {
  const run = spawnSync(process.execPath, ['app.js'], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: { ...process.env, ...PRODUCTION, AI_PROVIDER: 'mock', PORT: '0' },
    encoding: 'utf8',
    timeout: 20_000,
  });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /NooblyJS refused to start: AI_PROVIDER=mock gives scripted answers and is not allowed when NODE_ENV=production/);
  assert.match(run.stderr, /bedrock, vertex or azure/);
});

test('in production the dev tools are absent: no /dev app in the shell, no dev API, no Teams simulator key', async () => {
  assert.equal(app.noobly.devKey, null, 'the Teams simulator key exists only with dev sign-in');
  assert.equal(app.noobly.simulator, null, 'the Teams simulator (and on-call simulator) exists only with dev sign-in');
  assert.ok(!app.noobly.shell.list().some((a) => a.mountPath === '/dev'), 'the /dev app (styleguide, Teams simulator) is not mounted');
  const page = await fetch(app.base + '/dev/styleguide', { redirect: 'manual' });
  assert.ok([302, 401, 404].includes(page.status) && !(await page.text()).includes('Styleguide'), `/dev/styleguide answered ${page.status}`);
  for (const path of ['/api/v1/dev/clock', '/api/v1/dev/teams']) {
    const res = await fetch(app.base + path);
    assert.ok([401, 404].includes(res.status), `${path} answered ${res.status}`);
  }
  const moved = await fetch(app.base + '/api/v1/dev/clock', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"days":1}' });
  assert.ok([401, 403, 404].includes(moved.status), `POST /api/v1/dev/clock answered ${moved.status}`);
});

test('in production the person picker is not offered on /login', async () => {
  const res = await fetch(app.base + '/login', { redirect: 'manual' });
  const page = await res.text();
  assert.doesNotMatch(page, /name="personId"/, 'the dev person picker is a development tool');
});

test('in production the clock cannot be moved', async () => {
  assert.equal(app.noobly.clock.movable, false);
  await assert.rejects(app.noobly.clock.advance({ workingDays: 1 }), /only be moved in development/);
});

test('Platform · Settings says in words whether a model is configured', () => {
  assert.equal(activeModel(null), null);
  assert.deepEqual([activeModel('none').configured, /No model is configured/.test(activeModel('none').text)], [false, true]);
  assert.match(activeModel('mock').text, /refused in production/);
  assert.equal(activeModel('bedrock').configured, true);
  assert.match(activeModel('bedrock').text, /AWS Bedrock/);
});
