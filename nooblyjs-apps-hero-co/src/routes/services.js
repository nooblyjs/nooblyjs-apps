// Services, environment groups and the GitHub connection of a workspace (roadmap 2.4–2.7), added to the workspace
// router so they sit behind session.requireWorkspace (a non-member gets a 404 from every one) and the isolation suite
// walks them. Owners and Members create and deploy; only the Owner connects GitHub (product.md §7). Environment
// values are write-only: answers carry keys, and a value comes back only through an audited reveal that names the
// service or group.
import { CREATABLE, PLANS, REGIONS, RUNTIMES, MAX_INSTANCES, planOf, regionOf, runtimeOf, estimate, specText } from '../../public/js/shared/catalog.js';
import { serviceView, groupView, githubView } from '../domain/records.js';
import { toWorkloadSpec, fromPlatformDeploy, mergeDeploy, hostFor, pathFor } from '../platform/workloads.js';
import { GithubError } from '../github/github.js';

const NAME = /^[a-z]([-a-z0-9]{0,61}[a-z0-9])?$/;
const ENV_KEY = /^[A-Za-z_][A-Za-z0-9_]{0,127}$/;
const REPO = /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;
const BRANCH = /^[A-Za-z0-9._/-]{1,200}$/;

/** A public Git repository's https:// URL (no credentials, query or fragment), or null. */
export function publicGitUrl(v) {
  if (typeof v !== 'string' || v.length > 500) return null;
  const s = v.trim();
  // URL() resolves '..' and percent-escapes away, so look at the text as written first.
  if (!s.startsWith('https://') || s.includes('%') || s.slice(8).split('/').includes('..')) return null;
  try {
    const u = new URL(s);
    if (!u.hostname || u.username || u.password || u.search || u.hash || u.pathname.length < 2) return null;
    if (!/^\/[A-Za-z0-9._~/-]+$/.test(u.pathname) || u.pathname.split('/').includes('..')) return null;
    return u.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}
const MAX_ENV = 100;
const sendError = (res, status, code, message, details) => res.status(status).json({ error: { code, message, ...(details ? { details } : {}) } });
const invalid = (res, details) => sendError(res, 422, 'invalid', 'Check the highlighted fields.', details);
const text = (v, max) => typeof v === 'string' && v.length <= max;
const actorOf = (person) => ({ id: person.id, name: person.name, kind: 'person' });

/** Checks a list of { key, value } (value may be omitted to keep a stored one when `existing` has the key). */
function checkVars(list, path, problems, existing = []) {
  if (list === undefined) return [];
  if (!Array.isArray(list) || list.length > MAX_ENV) {
    problems.push({ path, message: `Up to ${MAX_ENV} variables.` });
    return [];
  }
  const seen = new Set();
  const out = [];
  list.forEach((v, i) => {
    const key = typeof v?.key === 'string' ? v.key.trim() : '';
    if (!ENV_KEY.test(key)) return problems.push({ path: `${path}.${i}.key`, message: 'Letters, digits and underscores; not starting with a digit.' });
    if (seen.has(key)) return problems.push({ path: `${path}.${i}.key`, message: `${key} is set twice.` });
    seen.add(key);
    if (v.value === undefined && existing.some((e) => e.key === key)) return out.push({ key, keep: true });
    if (!text(v.value, 32_768)) return problems.push({ path: `${path}.${i}.value`, message: 'A value of up to 32 KB.' });
    return out.push({ key, value: v.value });
  });
  return out;
}

/** "KEY=value" lines (a .env file) → [{ key, value }]. Comments, blank lines and `export ` are allowed. */
export function parseDotEnv(source) {
  const out = [];
  for (const raw of String(source ?? '').split(/\r?\n/)) {
    const line = raw.trim().replace(/^export\s+/, '');
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    out.push({ key: line.slice(0, eq).trim(), value });
  }
  return out;
}

/**
 * @param {import('express').Router} router   the workspace router (router.param('workspace') already gates it)
 * @param {object} o
 */
export function addServiceRoutes(router, { session, records, secrets, github, platform, config, audit, realtime, W = '/workspaces/:workspace' }) {
  const seal = (ctx, key, value) => secrets.seal(value, `${ctx}:${key}`);
  const sealVars = (ctx, vars, existing = []) => vars.map((v) => (v.keep ? existing.find((e) => e.key === v.key) : { key: v.key, sealed: seal(ctx, v.key, v.value) }));
  const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
  const githubFailure = (res, err) => sendError(res, err.status === 409 ? 409 : err.status === 404 ? 404 : 502, err.status === 409 ? 'github_not_connected' : 'github', err.message);

  async function serviceOr404(req, res) {
    const s = await records.services.byName(req.workspace.id, req.params.service);
    if (!s) sendError(res, 404, 'not_found', 'No such service.');
    return s;
  }

  /** The service as its page shows it: plan words, URL, estimate, latest deploys. */
  async function fullView(s) {
    const plan = planOf(s.plan);
    const type = CREATABLE[s.type];
    const groups = (await Promise.all((s.envGroups ?? []).map((id) => records.envGroups.get(s.workspaceId, id)))).filter(Boolean);
    return {
      ...serviceView(s),
      typeLabel: type?.label ?? s.type,
      planName: plan?.name ?? s.plan,
      spec: plan ? specText(plan) : null,
      runtimeName: runtimeOf(s.build?.runtime)?.name ?? s.build?.runtime ?? null,
      regionName: regionOf(s.region)?.name ?? s.region,
      local: Boolean(regionOf(s.region)?.local),
      // A Local network service answers on this app's URL (infra 8.9): the path, and the whole URL from PUBLIC_URL.
      ...(regionOf(s.region)?.local && type?.publicUrl ? { path: pathFor(s.workspaceId, s.name), url: `${config.publicUrl}${pathFor(s.workspaceId, s.name)}` } : {}),
      estimate: estimate(s.plan),
      sleepsWhenIdle: Boolean(type?.sleeps),
      envGroups: groups.map((g) => ({ id: g.id, name: g.name })),
      deploys: await records.deploys.list(s.workspaceId, { serviceId: s.id, limit: 10 }),
    };
  }

  // ---- the catalogue -----------------------------------------------------------------

  router.get(`${W}/catalog`, (req, res) => res.json({
    plans: PLANS, regions: REGIONS.map((r) => ({ id: r.id, name: r.name, available: Boolean(r.platform), local: Boolean(r.local) })), runtimes: RUNTIMES, creatable: CREATABLE, appDomain: config.appDomain,
  }));

  // ---- services ----------------------------------------------------------------------

  router.get(`${W}/services`, wrap(async (req, res) => {
    const list = (await records.services.list(req.workspace.id)).sort((a, b) => a.name.localeCompare(b.name));
    res.json({ services: list.map(serviceView) });
  }));

  router.get(`${W}/services/:service`, wrap(async (req, res) => {
    const s = await serviceOr404(req, res);
    if (s) res.json(await fullView(s));
  }));

  /** Creates a service from a GitHub repo and starts its first deploy (the New web service screen). */
  router.post(`${W}/services`, wrap(async (req, res) => {
    const ws = req.workspace.id;
    const b = req.body ?? {};
    const problems = [];
    const type = CREATABLE[b.type];
    if (!type) return invalid(res, [{ path: 'type', message: `Choose one of ${Object.values(CREATABLE).map((t) => t.label).join(', ')}.` }]);

    const name = typeof b.name === 'string' ? b.name.trim() : '';
    if (!NAME.test(name)) problems.push({ path: 'name', message: 'Lower-case letters, digits and hyphens, starting with a letter; up to 63 characters.' });
    else if (await records.services.byName(ws, name)) problems.push({ path: 'name', message: `You already have a service called ${name}.` });

    // The source: a repository through the GitHub connection, or a public Git URL (repoUrl) that needs no connection.
    const fromUrl = b.repoUrl !== undefined && b.repoUrl !== null && b.repoUrl !== '';
    const gitUrl = fromUrl ? publicGitUrl(b.repoUrl) : null;
    if (fromUrl && !gitUrl) problems.push({ path: 'repoUrl', message: 'A public https:// Git URL, such as https://github.com/render-examples/express-hello-world.' });
    const connection = fromUrl ? null : await records.github.get(ws);
    const repoName = typeof b.repo === 'string' ? b.repo.trim() : '';
    let repo = null;
    if (fromUrl) { /* checked above */ } else if (!connection) problems.push({ path: 'repo', message: 'Connect GitHub first: the workspace owner does it on the GitHub page.' });
    else if (!REPO.test(repoName)) problems.push({ path: 'repo', message: 'Choose a repository.' });
    else {
      try {
        repo = await github.repo(ws, repoName);
      } catch (err) {
        if (!(err instanceof GithubError)) throw err;
        problems.push({ path: 'repo', message: err.message });
      }
    }
    const branch = typeof b.branch === 'string' && b.branch.trim() ? b.branch.trim() : repo?.defaultBranch ?? 'main';
    if (fromUrl && (!BRANCH.test(branch) || branch.startsWith('-') || branch.includes('..'))) problems.push({ path: 'branch', message: 'A branch name, such as main.' });
    if (repo) {
      try {
        if (!(await github.branches(ws, repo.fullName)).includes(branch)) problems.push({ path: 'branch', message: `${repo.fullName} has no branch ${branch}.` });
      } catch (err) {
        if (!(err instanceof GithubError)) throw err;
        problems.push({ path: 'branch', message: err.message });
      }
    }

    const region = regionOf(b.region ?? 'af-south');
    if (!region) problems.push({ path: 'region', message: 'Choose a region.' });
    else if (!region.platform) problems.push({ path: 'region', message: `${region.name} is not open yet. Choose ${REGIONS.filter((r) => r.platform).map((r) => r.name).join(' or ')}.` });
    const runtime = runtimeOf(b.runtime ?? 'node22');
    if (!runtime) problems.push({ path: 'runtime', message: 'Choose a runtime.' });
    const rootDir = typeof b.rootDir === 'string' ? b.rootDir.trim().replace(/^(\.\/)+/, '').replace(/\/+$/, '') : '';
    if (!text(rootDir, 200) || rootDir.startsWith('/') || rootDir.split('/').includes('..')) problems.push({ path: 'rootDir', message: 'A folder inside the repository, such as apps/api.' });
    for (const key of ['buildCommand', 'startCommand']) if (b[key] !== undefined && b[key] !== null && (!text(b[key], 500) || /[\r\n]/.test(b[key]))) problems.push({ path: key, message: 'One line of up to 500 characters.' });
    const plan = planOf(b.plan ?? 'standard');
    if (!plan) problems.push({ path: 'plan', message: 'Choose an instance type.' });
    const instances = type.instances ? Number(b.instances ?? 1) : 1;
    if (!Number.isInteger(instances) || instances < 1 || instances > MAX_INSTANCES) problems.push({ path: 'instances', message: `Between 1 and ${MAX_INSTANCES}.` });
    const vars = checkVars(b.env, 'env', problems);
    const groupIds = Array.isArray(b.envGroups) ? [...new Set(b.envGroups)] : [];
    const groups = [];
    for (const id of groupIds) {
      const g = typeof id === 'string' ? await records.envGroups.get(ws, id) : null;
      if (g) groups.push(g);
      else problems.push({ path: 'envGroups', message: 'One of the linked environment groups no longer exists.' });
    }
    if (problems.length) return invalid(res, problems);

    // GitHub tells us the commit; a public URL's commit is the one the build finds on the branch.
    let commit = { sha: undefined, message: undefined };
    if (!fromUrl) {
      try {
        commit = await github.latestCommit(ws, repo.fullName, branch);
      } catch (err) {
        if (!(err instanceof GithubError)) throw err;
        return invalid(res, [{ path: 'branch', message: err.message }]);
      }
    }
    const repoLabel = fromUrl ? gitUrl.replace(/^https:\/\//, '').replace(/\.git$/, '') : repo.fullName;

    // Our record first, so the platform's events find it; removed again if the platform refuses.
    const service = await records.services.create({
      workspaceId: ws, name, type: b.type,
      source: fromUrl ? { provider: 'git', repo: repoLabel, url: gitUrl, branch, rootDir } : { provider: 'github', repo: repo.fullName, branch, rootDir },
      build: { runtime: runtime.key, buildCommand: b.buildCommand || null, startCommand: b.startCommand || null },
      region: region.id, plan: plan.key, instances,
      env: [], envGroups: groups.map((g) => g.id),
      autoDeploy: b.autoDeploy !== false,
      url: type.publicUrl ? (region.local ? `${config.publicUrl}${pathFor(ws, name)}` : `https://${hostFor(name, config.appDomain)}`) : null,
      internalHost: b.type === 'private' ? `${name}:10000` : null,
      status: 'deploying', current: null, workload: name,
      createdBy: { id: req.person.id, name: req.person.name },
    });
    const withEnv = await records.services.update(ws, service.id, { env: sealVars(`svc:${service.id}`, vars) });

    let created;
    try {
      created = await platform().workloads.create(ws, toWorkloadSpec(withEnv, { appDomain: config.appDomain, groups }), { actor: actorOf(req.person), commit: commit.sha, message: commit.message });
    } catch (err) {
      await records.services.remove(ws, service.id);
      const fields = err.details?.fields ?? {};
      if (err.code === 'conflict' && (fields.domains || /in use/.test(err.message))) return invalid(res, [{ path: 'name', message: `${hostFor(name, config.appDomain)} is taken. Choose another name.` }]);
      if (err.code === 'conflict') return invalid(res, [{ path: 'name', message: `You already have a service called ${name}.` }]);
      if (err.code === 'quota') return sendError(res, 429, 'quota', 'This workspace has reached its limit of services.');
      if (err.code === 'unavailable') return sendError(res, 503, 'unavailable', 'The platform cannot take new services right now. Try again in a minute.');
      if (err.code === 'invalid') return invalid(res, Object.entries(fields).map(([path, message]) => ({ path: path.startsWith('plan') ? 'plan' : path.startsWith('run.env') ? 'env' : path, message })));
      throw err;
    }

    const first = (await platform().deploys.list(ws, name, { limit: 1 })).deploys[0];
    let deploy = null;
    if (first) {
      const prev = await records.deploys.get(ws, first.id);
      deploy = await records.deploys.upsert(ws, first.id, mergeDeploy(prev, { ...fromPlatformDeploy(first), serviceId: service.id, serviceName: name }));
    }
    await audit({ action: 'service.created', actor: req.person.id, target: ws, detail: { service: name, type: b.type, repo: repoLabel, operation: created.operation.id } });
    realtime.publish(ws, 'deploy', { service: name, deploy });
    const saved = await records.services.byName(ws, name);
    res.status(201).json({ service: await fullView(saved), deploy, redirect: `/w/${ws}/services/${name}` });
  }));

  /** The service's console output (Local network services, infra 8.9 R11): lines after a cursor; live ones arrive as 'log' events. */
  router.get(`${W}/services/:service/logs`, wrap(async (req, res) => {
    const s = await serviceOr404(req, res);
    if (!s) return;
    const after = Math.max(0, Number.parseInt(req.query.after ?? '0', 10) || 0);
    try {
      const { lines, cursor } = await platform().logs.tail(req.workspace.id, s.workload ?? s.name, { after, limit: 500 });
      res.json({ lines: lines.map((l) => ({ seq: l.seq, at: l.at, out: l.out, line: l.line, instance: l.instance ? l.instance.slice(-6) : null })), cursor });
    } catch (err) {
      if (err.code === 'not_found') return res.json({ lines: [], cursor: 0 });
      throw err;
    }
  }));

  router.get(`${W}/services/:service/deploys`, wrap(async (req, res) => {
    const s = await serviceOr404(req, res);
    if (s) res.json({ deploys: await records.deploys.list(req.workspace.id, { serviceId: s.id, limit: 50 }) });
  }));

  /** One deploy with its build and rollout log (from the platform). */
  router.get(`${W}/services/:service/deploys/:deploy`, wrap(async (req, res) => {
    const s = await serviceOr404(req, res);
    if (!s) return;
    const d = await records.deploys.get(req.workspace.id, req.params.deploy);
    if (!d || d.serviceId !== s.id) return sendError(res, 404, 'not_found', 'No such deploy.');
    const fromPlatform = s.workload ? await platform().deploys.get(req.workspace.id, s.workload, d.id).catch(() => null) : null;
    res.json({ ...d, log: fromPlatform?.log ?? [] });
  }));

  /** Replaces the service's environment variables (a value left out keeps the stored one) and redeploys. */
  router.put(`${W}/services/:service/env`, wrap(async (req, res) => {
    const s = await serviceOr404(req, res);
    if (!s) return;
    const problems = [];
    const vars = checkVars(req.body?.env ?? [], 'env', problems, s.env);
    if (problems.length) return invalid(res, problems);
    const env = sealVars(`svc:${s.id}`, vars, s.env);
    const updated = await records.services.update(req.workspace.id, s.id, { env });
    let operation = null;
    if (s.workload) {
      const groups = (await Promise.all((s.envGroups ?? []).map((id) => records.envGroups.get(s.workspaceId, id)))).filter(Boolean);
      const spec = toWorkloadSpec(updated, { appDomain: config.appDomain, groups });
      ({ operation } = await platform().workloads.update(req.workspace.id, s.workload, { run: spec.run }, { actor: actorOf(req.person) }));
      // Values travel as references (hero:svc:<id>:<KEY>), so a changed value of an existing key changes nothing the
      // platform can see: deploy, as Render does when environment changes are saved, so the app gets the new value.
      if (!operation && updated.status !== 'suspended') {
        ({ operation } = await platform().workloads.deploy(req.workspace.id, s.workload, { actor: actorOf(req.person), trigger: 'config', message: 'Environment changed' }));
      }
    }
    await audit({ action: 'service.env-changed', actor: req.person.id, target: req.workspace.id, detail: { service: s.name, keys: env.map((e) => e.key) } });
    res.json({ env: env.map((e) => ({ key: e.key })), redeploying: Boolean(operation) });
  }));

  /** Reveals one value; the person types the service's name to confirm (product.md §7). Audited. */
  router.post(`${W}/services/:service/env/:key/reveal`, wrap(async (req, res) => {
    const s = await serviceOr404(req, res);
    if (!s) return;
    if (req.body?.confirm !== s.name) return invalid(res, [{ path: 'confirm', message: `Type ${s.name} to reveal this value.` }]);
    const v = (s.env ?? []).find((e) => e.key === req.params.key);
    if (!v) return sendError(res, 404, 'not_found', 'No such variable.');
    await audit({ action: 'secret.revealed', actor: req.person.id, target: req.workspace.id, detail: { service: s.name, key: v.key } });
    res.json({ key: v.key, value: secrets.open(v.sealed, `svc:${s.id}:${v.key}`) });
  }));

  router.post(`${W}/env/parse`, (req, res) => {
    const vars = parseDotEnv(typeof req.body?.text === 'string' ? req.body.text.slice(0, 256_000) : '');
    // Only the keys and values the person pasted come back to them; nothing is stored.
    res.json({ env: vars.filter((v) => ENV_KEY.test(v.key)).slice(0, MAX_ENV), skipped: vars.filter((v) => !ENV_KEY.test(v.key)).length });
  });

  // ---- environment groups -------------------------------------------------------------

  router.get(`${W}/env-groups`, wrap(async (req, res) => {
    const ws = req.workspace.id;
    const services = await records.services.list(ws);
    const groups = (await records.envGroups.list(ws)).sort((a, b) => a.name.localeCompare(b.name));
    res.json({ groups: groups.map((g) => ({ ...groupView(g), services: services.filter((s) => s.envGroups?.includes(g.id)).map((s) => s.name) })) });
  }));

  router.post(`${W}/env-groups`, wrap(async (req, res) => {
    const ws = req.workspace.id;
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const problems = [];
    if (!name || name.length > 60) problems.push({ path: 'name', message: 'A name of up to 60 characters.' });
    else if ((await records.envGroups.list(ws)).some((g) => g.name.toLowerCase() === name.toLowerCase())) problems.push({ path: 'name', message: `There is already a group called ${name}.` });
    const vars = checkVars(req.body?.vars ?? [], 'vars', problems);
    if (problems.length) return invalid(res, problems);
    const group = await records.envGroups.create({ workspaceId: ws, name });
    const saved = await records.envGroups.update(ws, group.id, { vars: sealVars(`grp:${group.id}`, vars) });
    await audit({ action: 'env-group.created', actor: req.person.id, target: ws, detail: { group: name, keys: vars.map((v) => v.key) } });
    res.status(201).json(groupView(saved));
  }));

  router.get(`${W}/env-groups/:group`, wrap(async (req, res) => {
    const g = await records.envGroups.get(req.workspace.id, req.params.group);
    if (!g) return sendError(res, 404, 'not_found', 'No such environment group.');
    res.json(groupView(g));
  }));

  /** Replaces a group's variables (a value left out keeps the stored one); linked services redeploy. */
  router.put(`${W}/env-groups/:group`, wrap(async (req, res) => {
    const ws = req.workspace.id;
    const g = await records.envGroups.get(ws, req.params.group);
    if (!g) return sendError(res, 404, 'not_found', 'No such environment group.');
    const problems = [];
    const vars = checkVars(req.body?.vars ?? [], 'vars', problems, g.vars);
    if (problems.length) return invalid(res, problems);
    const saved = await records.envGroups.update(ws, g.id, { vars: sealVars(`grp:${g.id}`, vars, g.vars) });
    const linked = (await records.services.list(ws)).filter((s) => s.envGroups?.includes(g.id) && s.workload);
    for (const s of linked) {
      const groups = (await Promise.all(s.envGroups.map((id) => records.envGroups.get(ws, id)))).filter(Boolean);
      const spec = toWorkloadSpec(s, { appDomain: config.appDomain, groups });
      const { operation } = await platform().workloads.update(ws, s.workload, { run: spec.run }, { actor: actorOf(req.person) });
      // A changed value keeps its reference: deploy so the service gets it (as on the service's own Environment).
      if (!operation && s.status !== 'suspended') {
        await platform().workloads.deploy(ws, s.workload, { actor: actorOf(req.person), trigger: 'config', message: `Environment group ${g.name} changed` });
      }
    }
    await audit({ action: 'env-group.changed', actor: req.person.id, target: ws, detail: { group: g.name, keys: saved.vars.map((v) => v.key) } });
    res.json({ ...groupView(saved), redeploying: linked.map((s) => s.name) });
  }));

  router.delete(`${W}/env-groups/:group`, wrap(async (req, res) => {
    const ws = req.workspace.id;
    const g = await records.envGroups.get(ws, req.params.group);
    if (!g) return sendError(res, 404, 'not_found', 'No such environment group.');
    const linked = (await records.services.list(ws)).filter((s) => s.envGroups?.includes(g.id));
    if (linked.length) return sendError(res, 409, 'conflict', `Unlink it from ${linked.map((s) => s.name).join(', ')} first.`);
    await records.envGroups.remove(ws, g.id);
    await audit({ action: 'env-group.deleted', actor: req.person.id, target: ws, detail: { group: g.name } });
    res.status(204).end();
  }));

  router.post(`${W}/env-groups/:group/vars/:key/reveal`, wrap(async (req, res) => {
    const g = await records.envGroups.get(req.workspace.id, req.params.group);
    if (!g) return sendError(res, 404, 'not_found', 'No such environment group.');
    if (req.body?.confirm !== g.name) return invalid(res, [{ path: 'confirm', message: `Type ${g.name} to reveal this value.` }]);
    const v = g.vars.find((e) => e.key === req.params.key);
    if (!v) return sendError(res, 404, 'not_found', 'No such variable.');
    await audit({ action: 'secret.revealed', actor: req.person.id, target: req.workspace.id, detail: { group: g.name, key: v.key } });
    res.json({ key: v.key, value: secrets.open(v.sealed, `grp:${g.id}:${v.key}`) });
  }));

  // ---- GitHub --------------------------------------------------------------------------

  router.get(`${W}/github`, wrap(async (req, res) => {
    const c = await records.github.get(req.workspace.id);
    res.json({
      enabled: github.enabled, mock: github.mock, connected: Boolean(c), ...(c ? githubView(c) : {}),
      canManage: req.workspace.role === 'Owner', connectUrl: `/w/${req.workspace.id}/github/connect`,
    });
  }));

  router.get(`${W}/github/repos`, wrap(async (req, res) => {
    try {
      const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase().slice(0, 100) : '';
      const repos = await github.repos(req.workspace.id, { refresh: req.query.refresh === '1' });
      res.json({ repos: repos.filter((r) => !q || r.fullName.toLowerCase().includes(q)) });
    } catch (err) {
      if (err instanceof GithubError) return githubFailure(res, err);
      throw err;
    }
  }));

  router.get(`${W}/github/repos/:owner/:repo/branches`, wrap(async (req, res) => {
    try {
      res.json({ branches: await github.branches(req.workspace.id, `${req.params.owner}/${req.params.repo}`) });
    } catch (err) {
      if (err instanceof GithubError) return githubFailure(res, err);
      throw err;
    }
  }));

  router.delete(`${W}/github`, session.requireOwner, wrap(async (req, res) => {
    await github.disconnect(req.workspace.id);
    await audit({ action: 'github.disconnected', actor: req.person.id, target: req.workspace.id });
    res.status(204).end();
  }));
}
