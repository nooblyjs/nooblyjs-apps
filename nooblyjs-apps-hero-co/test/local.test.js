// The Local network region (infra spec 8.9; decided 2026-11-20): a web service from a public Git URL runs on this
// machine's servers through the agent (the in-process mock agent in tests), answers at <base URL>/<workspace>/<service>/
// on this app's own URL, and streams its console output to the service page. The proxy never hands the app our cookies,
// drops the app's cookies and sandboxes its pages; another workspace sees none of it.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { startApp } from './helpers.js';
import { stripOurCookies } from '../src/routes/proxy.js';
import { publicGitUrl } from '../src/routes/services.js';

let t;
before(async () => {
  t = await startApp();
  await t.accelerators.mounted.infrastructure.local.agent.welcome;
});
after(async () => { await t?.close(); });

const WS = '/api/v1/workspaces/exclusivity-life';
const docker = () => t.accelerators.mounted.infrastructure.local.agent.docker;
const until = async (fn, ms = 3000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await fn()) return true;
    await new Promise((r) => setTimeout(r, 10));
  }
  return false;
};

test('public Git URLs and our cookies', () => {
  assert.equal(publicGitUrl('https://github.com/render-examples/express-hello-world'), 'https://github.com/render-examples/express-hello-world');
  for (const bad of ['http://github.com/a/b', 'https://u:p@github.com/a/b', 'https://github.com/a/b?x=1', 'git@github.com:a/b.git', 'https://github.com/../etc', 'file:///etc']) assert.equal(publicGitUrl(bad), null, bad);
  assert.equal(stripOurCookies('hero.sid=abc; theme=dark; noobly.csrf=x'), 'theme=dark');
  assert.equal(stripOurCookies('hero.sid=abc'), null);
});

test('a web service from a public Git URL in Local network: Live, at /<workspace>/<service>/, with its logs', async () => {
  const res = await t.post(`${WS}/services`, {
    as: 'stevie',
    body: { type: 'web', name: 'hello', repoUrl: 'https://github.com/render-examples/express-hello-world', branch: 'main', region: 'local', runtime: 'node22', plan: 'starter', instances: 1, env: [{ key: 'GREETING', value: 'hi there' }] },
  });
  assert.equal(res.status, 201, JSON.stringify(res.json));
  assert.equal(res.json.service.path, '/exclusivity-life/hello/');
  assert.equal(res.json.service.url, `${t.base}/exclusivity-life/hello/`);
  await t.idle();

  const svc = (await t.get(`${WS}/services/hello`, { as: 'stevie' })).json;
  assert.equal(svc.status, 'live');
  assert.match(svc.deploys[0].commit, /^[0-9a-f]{40}$/, 'the commit the build found, not a made-up one');
  assert.equal(svc.current.commit, svc.deploys[0].commit);
  assert.deepEqual([svc.local, svc.regionName, svc.source.repo, svc.source.provider], [true, 'Local network', 'github.com/render-examples/express-hello-world', 'git']);

  // The build ran on the server: its lines are in the deploy log.
  const log = (await t.get(`${WS}/services/hello/deploys/${svc.deploys[0].id}`, { as: 'stevie' })).json.log.map((l) => l.text).join('\n');
  assert.match(log, /Cloning https:\/\/github.com\/render-examples\/express-hello-world \(main\)/);
  assert.match(log, /Healthy/);

  // The container: the Starter plan's limits, PORT, and our secret opened at deploy (never kept by the platform).
  const [c] = docker().state.containers;
  assert.deepEqual([c.args.cpu, c.args.memoryMb, c.args.port], [0.5, 512, 10000]);
  assert.deepEqual(c.args.env, [{ key: 'GREETING', value: 'hi there' }, { key: 'PORT', value: '10000' }]);

  // Logs: the start-up line now, then live lines over the workspace channel.
  const events = [];
  const stop = t.realtime.subscribe(['exclusivity-life'], (e) => events.push(e));
  assert.ok(await until(async () => (await t.get(`${WS}/services/hello/logs`, { as: 'stevie' })).json.lines.some((l) => l.line === 'Listening on port 10000')));
  docker().emit(c.name, 'GET / 200', 'stdout');
  const got = await until(() => events.some((e) => e.type === 'log' && e.data.service === 'hello' && e.data.lines.some((l) => l.line === 'GET / 200')));
  assert.ok(got, JSON.stringify(events).slice(0, 600));
  stop();
  assert.equal((await t.get(`${WS}/services/hello/logs`, { as: 'amara' })).status, 404, 'another workspace: 404');
});

test('the proxy: /<workspace>/<service>/… reaches the instance without our cookies; their cookies are dropped; pages are sandboxed', async () => {
  const [endpoint] = await t.platform().workloads.endpoints('exclusivity-life', 'hello');
  const port = Number(new URL(endpoint.url).port);
  // Stand in for the container on its host port.
  const seen = [];
  const app = http.createServer((req, res) => {
    seen.push({ url: req.url, cookie: req.headers.cookie ?? null, prefix: req.headers['x-forwarded-prefix'] });
    if (req.url === '/go') {
      res.writeHead(302, { location: '/there' });
      return res.end();
    }
    res.writeHead(200, { 'content-type': 'text/html', 'set-cookie': 'hero.sid=planted; Path=/', 'content-security-policy': "default-src *" });
    res.end('<!doctype html><title>Hello from Render!</title><script>document.cookie</script>');
  });
  await new Promise((r) => app.listen(port, '127.0.0.1', r));
  try {
    const page = await fetch(`${t.base}/exclusivity-life/hello/?q=1`, { headers: { cookie: 'hero.sid=secret-session; noobly.csrf=tok; theme=dark' } });
    assert.equal(page.status, 200);
    assert.match(await page.text(), /Hello from Render!/);
    assert.deepEqual(seen.at(-1), { url: '/?q=1', cookie: 'theme=dark', prefix: '/exclusivity-life/hello/' });
    assert.equal(page.headers.get('set-cookie'), null, 'the app cannot set cookies on our origin');
    assert.match(page.headers.get('content-security-policy'), /^sandbox allow-scripts/);
    assert.doesNotMatch(page.headers.get('content-security-policy'), /allow-same-origin/);

    const bare = await fetch(`${t.base}/exclusivity-life/hello`, { redirect: 'manual' });
    assert.deepEqual([bare.status, bare.headers.get('location')], [308, '/exclusivity-life/hello/']);
    const redirect = await fetch(`${t.base}/exclusivity-life/hello/go`, { redirect: 'manual' });
    assert.equal(redirect.headers.get('location'), '/exclusivity-life/hello/there', 'redirects stay under the prefix');
  } finally {
    await new Promise((r) => app.close(r));
  }
  // Nothing listening: a plain 502, not our app's page.
  const down = await fetch(`${t.base}/exclusivity-life/hello/`);
  assert.equal(down.status, 502);
  // Not a running service: our own pages and 404s as before.
  assert.notEqual((await fetch(`${t.base}/exclusivity-life/nothing-here/`)).status, 502);
  assert.equal((await fetch(`${t.base}/health/live`)).status, 200);
});

test('a lost server: the proxy hears its instances go unknown and answers 503 for the service, then routes again when it returns', async () => {
  const infra = t.accelerators.mounted.infrastructure;
  const [endpoint] = await t.platform().workloads.endpoints('exclusivity-life', 'hello');
  assert.ok(endpoint, 'hello is running');
  infra.agents.disconnect(endpoint.server, 'Blip (test).', { retry: true });
  assert.ok(await until(async () => (await fetch(`${t.base}/exclusivity-life/hello/`)).status === 503));
  const lost = await fetch(`${t.base}/exclusivity-life/hello/`);
  assert.equal(lost.headers.get('retry-after'), '30');
  assert.match(await lost.text(), /no instance answering right now/);
  // The agent comes back with its credential; the container is still there, so the route is back (502 here only
  // because nothing stands in for the container on its port).
  await infra.local.agent.reconnect();
  assert.ok(await until(async () => (await fetch(`${t.base}/exclusivity-life/hello/`)).status === 502));
  assert.equal((await t.platform().workloads.endpoints('exclusivity-life', 'hello')).length, 1);
});

test('a new server fetches install.sh and the agent files without a sign-in; the rest of /infrastructure stays operators only', async () => {
  const script = await fetch(`${t.base}/infrastructure/agent/install.sh`);
  assert.equal(script.status, 200);
  assert.ok((await script.text()).includes(`CONTROLLER="${t.base}/infrastructure"`));
  assert.equal((await fetch(`${t.base}/infrastructure/agent/files/bin/noobly-agent.js`)).status, 200);
  // Not on the list: the operator gate answers, and customers get a 404.
  assert.notEqual((await fetch(`${t.base}/infrastructure/agent/files/mock.js`, { redirect: 'manual' })).status, 200);
  assert.notEqual((await fetch(`${t.base}/infrastructure/api/v1/platform/local`, { redirect: 'manual' })).status, 200);
  assert.equal((await t.get('/infrastructure/api/v1/platform/local', { as: 'stevie' })).status, 404);
  assert.equal((await t.post('/infrastructure/agent/install.sh', { as: 'stevie' })).status, 404, 'only GET is let through');
});
