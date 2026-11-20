// createApp(): the NooblyJS Cloud Express app, without listening (app.js listens; the tests use an ephemeral port).
//
// Order: security headers → session cookie, who is signed in, CSRF → core's /services portal gated to platform
// operators → nooblyjs-core → dev sign-in and mock GitHub (not in production) → health → gates → the operator frame
// and /ui kit → the accelerators → sign-in routes → our API → static files → pages → 404 and errors.
import fs from 'node:fs/promises';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
import express from 'express';
import helmet from 'helmet';
import { ROOT, loadConfig } from './config.js';
import { createAccounts } from './platform/accounts.js';
import { createSession } from './platform/session.js';
import { INFRA_MATRIX, DEV_PEOPLE, DEV_PASSWORD, OPERATOR_ROLES } from './platform/people.js';
import { createServiceProxy } from './routes/proxy.js';
import { createHost } from './platform/host.js';
import { createRealtime, OPERATORS } from './platform/realtime.js';
import { mountAccelerators, INFRA_MOUNT, CX_BASE, CX_PUBLIC } from './platform/accelerators.js';
import { createCustomersLink } from './platform/customers-link.js';
import { createCoreAuth, createAuth, githubMockRoutes } from './platform/auth.js';
import { createApi } from './routes/api.js';
import { createWorkspacesApi } from './routes/workspaces.js';
import { createPages } from './routes/pages.js';
import { createGithubConnect } from './routes/github-connect.js';
import { createRecords } from './domain/records.js';
import { createSecrets } from './domain/secrets.js';
import { createGithub } from './github/github.js';
import { followDeploys } from './platform/workloads.js';
import { seedRecords } from './domain/seed.js';

const require = createRequire(import.meta.url);
const { helmetCspOption } = require('nooblyjs-core/src/shared/utils/contentSecurityPolicy.js');
const { createShell, UI_DIR } = require('nooblyjs-core/src/shell');
const { context: cxContext } = require('nooblyjs-accel-customers');
const { version: VERSION } = JSON.parse(await fs.readFile(path.join(ROOT, 'package.json'), 'utf8'));

/**
 * @param {object} [o]
 * @param {ReturnType<typeof loadConfig>} [o.config]
 * @param {object} [o.serviceRegistry]   nooblyjs-core (the real one unless a test passes another)
 * @param {boolean} [o.seed]             write the infrastructure seed story when its folder is empty
 * @param {number} [o.mockStepMs]
 * @param {number} [o.jobCheckMs]
 * @param {(host: object) => object} [o.changeInfraHost]   tests: alter the infrastructure host before mounting
 */
export async function createApp({ config = loadConfig(), serviceRegistry = require('nooblyjs-core'), seed = false, mockStepMs, jobCheckMs, changeInfraHost = (h) => h } = {}) {
  if (config.production && config.devSignIn) throw new Error('The development sign-in cannot run with NODE_ENV=production.');
  if (config.production && !config.sessionSecret) throw new Error('SESSION_SECRET is required in production.');
  await fs.mkdir(config.dataDir, { recursive: true });

  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: helmetCspOption() }));
  // Local network services at /<workspace>/<service>/… (routes/proxy.js), before sessions: they are other people's
  // apps, so they never see our session. Set once the accelerators are mounted.
  let serviceProxy = null;
  app.use((req, res, next) => (serviceProxy ? serviceProxy.middleware(req, res, next) : next()));

  // Sessions run before nooblyjs-core so its /services portal (and its own login API) can be closed to customers.
  // The handlers are bound below, once core (and the accounts store on its dataService) exists.
  let session = null;
  app.use((req, res, next) => session.cookie(req, res, next));
  app.use((req, res, next) => session.identify(req, res, next));
  app.use((req, res, next) => session.csrf(req, res, next));
  // nooblyjs-core's login page is the only sign-in screen; this app answers its API (auth.js), ahead of core.
  let coreLogin = null;
  app.use((req, res, next) => (coreLogin ? coreLogin(req, res, next) : next()));
  app.use('/services', (req, res, next) => session.requirePlatform(req, res, next));

  // nooblyjs-core: one shared emitter for core and every accelerator.
  const eventEmitter = new EventEmitter().setMaxListeners(100);
  serviceRegistry.initialize(app, eventEmitter, {
    security: { apiKeyAuth: { requireApiKey: false, apiKeys: [] }, servicesAuth: { requireLogin: true } },
  });
  const log = serviceRegistry.logger('console', { instanceName: 'hero-co' });
  const data = serviceRegistry.dataService('file', { instanceName: 'nooblyjs-cloud', dataDir: path.join(config.dataDir, 'data') });
  const accounts = createAccounts({ data });
  await accounts.init();
  const records = createRecords({ data });
  await records.init();
  const secrets = await createSecrets({ dataDir: config.dataDir, keyMaterial: config.secretKey, production: config.production });
  const github = createGithub({ records, secrets, config });
  const core = await createCoreAuth({ serviceRegistry, dataDir: config.dataDir });
  session = createSession({ accounts, config, log });

  if (config.devSignIn) {
    app.use(session.devRoutes(express));
    app.use('/dev/github', githubMockRoutes(express));
  }

  app.get('/health/live', (req, res) => res.json({ status: 'ok' }));

  // The back office: operators only, except the customers accelerator's public marketing routes.
  // The one exception under /infrastructure: the agent's install script and files (infra spec 8.9 R2), which a server
  // being set up fetches without a sign-in. They are the agent's own source, with no secret; the list is the accelerator's.
  let infraPublic = new Set();
  app.use(INFRA_MOUNT, (req, res, next) => (req.method === 'GET' && infraPublic.has(req.path) ? next() : session.requireOperator(req, res, next)));
  app.use(CX_BASE, (req, res, next) => (req.originalUrl.startsWith(CX_PUBLIC) ? next() : session.requireOperator(req, res, next)));

  const realtime = createRealtime();
  let shell = null;
  const host = createHost({ express, session, accounts, dataDir: config.dataDir, frame: () => shell.frame });
  const audit = (entry) => host.record(entry).catch((err) => log.warn?.(`[hero-co] audit write failed: ${err.message}`));
  host.events.on((event) => realtime.publish(OPERATORS, 'infrastructure', event));
  shell = createShell({
    express,
    auth: session.requireOperator,
    can: host.can,
    permissionsFor: async (role) => Object.keys(INFRA_MATRIX).filter((p) => INFRA_MATRIX[p].includes(role)),
    log,
  });
  app.use(shell.router);
  app.use('/ui', express.static(UI_DIR, { index: false, redirect: false }));

  /** Opens our secretRefs for the platform when a container starts (infra 8.9 R9); never logged, never kept there. */
  async function resolveSecrets(tenantId, refs) {
    const out = {};
    for (const ref of refs) {
      const m = /^hero:(svc|grp):([^:]+):([A-Za-z_][A-Za-z0-9_]*)$/.exec(ref);
      if (!m) continue;
      const [, kind, id, key] = m;
      const owner = kind === 'svc'
        ? (await records.services.list(tenantId)).find((s) => s.id === id)
        : await records.envGroups.get(tenantId, id);
      const v = (kind === 'svc' ? owner?.env : owner?.vars)?.find((e) => e.key === key);
      if (v?.sealed) out[ref] = secrets.open(v.sealed, `${kind}:${id}:${key}`);
    }
    return out;
  }

  const accelerators = await mountAccelerators({
    app, eventEmitter, serviceRegistry, shell, config, log, mockStepMs, jobCheckMs, resolveSecrets,
    dataDir: config.dataDir,
    infraHost: changeInfraHost(host.hostFor(path.join(config.dataDir, 'infrastructure'))),
  });
  infraPublic = new Set(accelerators.mounted.infrastructure.publicPaths ?? []);

  const platform = () => accelerators.mounted.infrastructure.services.platform;
  const deploysFollower = followDeploys({ eventEmitter, records, realtime, platform, log });
  // Runtime log lines of a service go to its workspace's live channel (the service page's Logs).
  const onLogLines = (e) => realtime.publish(e.tenantId, 'log', { service: e.workload, lines: e.lines });
  eventEmitter.on('infrastructure.workload.log', onLogLines);
  const proxy = createServiceProxy({ records, platform, eventEmitter, log });
  await proxy.load((await accounts.listWorkspaces()).map((w) => w.id));
  serviceProxy = proxy;

  const link = createCustomersLink({ cx: accelerators.mounted.customers, systemContext: cxContext.systemContext, accounts, log, audit });
  await link.ensureTemplates();
  await ensureCoreAdmins({ accounts, core, log });
  if (config.devSignIn) await seedDevPeople({ accounts, core, link });
  if (config.production && !config.emailChannel) {
    log.warn?.('[hero-co] No email channel is configured: account emails go to the customers accelerator\'s console outbox only.');
  }

  if (seed) {
    const infraDir = path.join(config.dataDir, 'infrastructure');
    const empty = (await fs.readdir(infraDir).catch(() => [])).filter((f) => !f.startsWith('.') && !['secrets', 'local', 'local-agent', 'config.yaml'].includes(f)).length === 0;
    if (empty) {
      await accelerators.mounted.infrastructure.seed({ reset: false });
      await seedRecords({ records, secrets, platform, accounts });
      await accelerators.mounted.infrastructure.resume();
    }
  }

  const auth = createAuth({ express, session, accounts, core, link, config, audit, log });
  coreLogin = auth.login;
  app.use('/api/v1/auth', auth.api);
  app.use(auth.pages);
  app.use('/api/v1', createWorkspacesApi({ express, session, accounts, link, config, audit, realtime, records, secrets, github, platform }));
  app.use('/api/v1', createApi({ express, session, realtime, accelerators: accelerators.describe, about: { name: 'nooblyjs-cloud', version: VERSION } }));
  app.use(express.static(path.join(ROOT, 'public'), { index: false, redirect: false }));
  app.use(createGithubConnect({ express, session, accounts, github, config, audit, log }));
  app.use(createPages({ express, session }));

  app.use((req, res) => {
    if (req.originalUrl.includes('/api/')) return res.status(404).json({ error: { code: 'not_found', message: 'No such API route.' } });
    res.status(404).type('text').send('Not found.');
  });
  // Never send a fault's message to the client.
  app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
    const status = err.status >= 400 && err.status < 500 ? err.status : 500;
    if (status === 500) log.error?.(`[hero-co] ${req.method} ${req.originalUrl}: ${err.stack ?? err.message}`);
    const message = status === 500 ? 'Something went wrong on our side.' : (err.expose ? err.message : 'The request was not valid.');
    if (req.originalUrl.includes('/api/')) return res.status(status).json({ error: { code: status === 500 ? 'internal' : 'invalid', message } });
    res.status(status).type('text').send(message);
  });

  /** Grants or removes an operator role (app.js --operator). */
  async function setOperator(email, role) {
    const person = await accounts.findPersonByEmail(email ?? '');
    if (!person) throw new Error(`No person with the email ${email}. They sign up first.`);
    if (role !== 'none' && !OPERATOR_ROLES.includes(role)) throw new Error(`The role is one of ${OPERATOR_ROLES.join(', ')} or none.`);
    const updated = await accounts.updatePerson(person.id, { operator: role === 'none' ? null : role, sessionEpoch: (person.sessionEpoch ?? 0) + 1 });
    await audit({ action: 'person.operator-changed', actor: 'cli', target: person.id, detail: { role } });
    return updated;
  }

  return {
    app,
    config,
    host,
    /** Call with the HTTP server once listening: local servers' agents connect over a WebSocket (infra spec 8.9). */
    attachUpgrades: (server) => host.attachUpgrades(server),
    realtime,
    accelerators,
    accounts,
    records,
    github,
    platform,
    core,
    link,
    /** The seed story's hero-co half (services, deploys, GitHub) on top of the infrastructure seed. */
    seedRecords: ({ reset = false } = {}) => seedRecords({ records, secrets, platform, accounts, reset }),
    /** For the tests: resolves when the platform has no operation under way and every deploy event is written. */
    async idle() {
      await accelerators.mounted.infrastructure.idle();
      await deploysFollower.idle();
    },
    serviceRegistry,
    eventEmitter,
    setOperator,
    async shutdown() {
      deploysFollower.stop();
      proxy.stop();
      eventEmitter.off('infrastructure.workload.log', onLogLines);
      await accelerators.shutdown();
      await session.close?.();
      await serviceRegistry.shutdown?.();
    },
  };
}

/**
 * nooblyjs-core's admins (its start-up admin, admin@localhost unless DEFAULT_ADMIN_EMAIL says otherwise, whose password
 * is in <dataDir>/auth/INITIAL_ADMIN_PASSWORD.txt or DEFAULT_ADMIN_PASSWORD) are this app's platform operators, so
 * they can sign in on core's login page and land on /admin. An existing account with the same email is left alone.
 */
async function ensureCoreAdmins({ accounts, core, log }) {
  for (const admin of await core.getUsersInRole('admin')) {
    if (!admin?.email) continue;
    let person = await accounts.findPersonByEmail(admin.email);
    if (!person) {
      person = await accounts.createPerson({ name: admin.fullName || 'Administrator', email: admin.email, emailVerified: true, operator: 'platform', signedUpWith: 'core-admin' });
      log.info?.(`[hero-co] ${admin.email} (nooblyjs-core admin) is a platform operator.`);
    }
    // The admin deploys like a customer, in a workspace of their own (/w/<id>; services at /<id>/<service>/).
    if (person.signedUpWith === 'core-admin' && !(await accounts.workspacesFor(person.id)).length) {
      const ws = await accounts.createWorkspace({ name: person.name || 'Administrator', ownerId: person.id });
      log.info?.(`[hero-co] ${admin.email} has the workspace ${ws.id}.`);
    }
  }
}

/** The development people (people.js), created once: each with a workspace, verified, linked to a customer. */
async function seedDevPeople({ accounts, core, link }) {
  for (const p of DEV_PEOPLE) {
    if (await accounts.getPerson(p.id)) continue;
    try {
      await core.createUser({ email: p.email, fullName: p.name, password: DEV_PASSWORD, role: 'user' });
    } catch (err) {
      if (!/already exists/i.test(err.message)) throw err;
    }
    const person = await accounts.createPerson({ id: p.id, name: p.name, email: p.email, emailVerified: true, operator: p.operator, signedUpWith: 'seed' });
    const workspace = p.workspace ? await accounts.createWorkspace({ id: p.workspace.id, name: p.workspace.name, ownerId: person.id }) : null;
    if (!p.operator) await link.linkPerson(person, { workspace, source: 'seed' });
  }
}
