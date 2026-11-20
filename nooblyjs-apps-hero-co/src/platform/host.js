// The `host` this app hands to the infrastructure accelerator's mount() (its architecture.md §3.2): sign-in,
// permissions, audit, events, a file store, people and the frame page. The infrastructure accelerator is for
// operators only, so its `auth` admits operators and nobody else.
import { createRequire } from 'node:module';
import { EventEmitter } from 'node:events';
import { createUpgradeRouter } from 'nooblyjs-accelerator-infrastructure/host';
import { INFRA_MATRIX, toPerson } from './people.js';

const require = createRequire(import.meta.url);
const { FsStore } = require('nooblyjs-core/src/store/fs-store.js');

/** What the infrastructure accelerator checks for (its index.js NEEDS). Checked here before anything is mounted. */
export const INFRA_HOST_NEEDS = ['express', 'auth', 'requireRole', 'can', 'audit', 'events', 'store', 'people', 'service', 'frame'];

const sendError = (res, status, code, message) => res.status(status).json({ error: { code, message } });
const day = (at) => [at.slice(0, 4), at.slice(5, 7), `${at.slice(0, 10)}.yaml`];

/**
 * @param {object} o
 * @param {typeof import('express')} o.express
 * @param {ReturnType<import('./session.js').createSession>} o.session
 * @param {ReturnType<import('./accounts.js').createAccounts>} o.accounts
 * @param {string} o.dataDir        audit and events are appended under <dataDir>/audit and <dataDir>/events
 * @param {() => Function} o.frame  the frame page handler (nooblyjs-core's shell), resolved when called
 * @param {Record<string, object>} [o.services]
 * @param {number} [o.keep]         how many audit records and events to keep in memory (for tests and the admin page)
 */
export function createHost({ express, session, accounts, dataDir, frame, services = {}, keep = 500 }) {
  const rootStore = new FsStore(dataDir);
  const auditLog = [];
  const eventLog = [];
  const bus = new EventEmitter().setMaxListeners(100);
  const remember = (list, item) => { list.push(item); if (list.length > keep) list.shift(); };

  const can = async (accessRole, permission) => (INFRA_MATRIX[permission] ?? []).includes(accessRole);

  async function record(entry) {
    const full = { at: new Date().toISOString(), ...entry };
    remember(auditLog, full);
    await rootStore.appendYaml(['audit', ...day(full.at)], full);
  }

  function requireRole(permission) {
    return async (req, res, next) => {
      const role = req.person?.accessRole;
      if (await can(role, permission)) return next();
      await record({ actor: req.person?.id ?? null, action: 'access.refused', target: `${req.method} ${req.originalUrl.split('?')[0]}`, permission });
      sendError(res, 403, 'forbidden', `This needs the "${permission}" permission. Your access role is ${role ?? 'none'}.`);
    };
  }

  const audit = Object.assign((req, res, next) => {
    res.on('finish', () => {
      record({ actor: req.person?.id ?? null, action: `${req.method} ${req.originalUrl.split('?')[0]}`, status: res.statusCode }).catch(() => {});
    });
    next();
  }, { record });

  const events = {
    async emit(type, payload, { actor } = {}) {
      const event = { at: new Date().toISOString(), type, actor: actor ?? null, payload };
      remember(eventLog, event);
      await rootStore.appendYaml(['events', ...day(event.at)], event);
      bus.emit('event', event);
      return event;
    },
    on(fn) {
      bus.on('event', fn);
      return () => bus.off('event', fn);
    },
  };

  const people = {
    list: async () => (await accounts.listPeople()).filter((p) => p.operator).map((p) => toPerson(p)),
    get: async (id) => toPerson(await accounts.getPerson(id)),
    getByEmail: async (email) => toPerson(await accounts.findPersonByEmail(email)),
  };

  // WebSocket upgrades: local servers' agents connect to /infrastructure/agent/v1 (infra spec 8.9).
  const upgrades = createUpgradeRouter();

  return {
    auditLog,
    eventLog,
    /** Passes the HTTP server's upgrades to what the accelerator registered with host.onUpgrade. */
    attachUpgrades: (server) => upgrades.attach(server),
    events,
    can,
    record,
    /** The host for one accelerator, with its store rooted at that accelerator's folder. */
    hostFor(appDir) {
      return {
        express,
        auth: session.requireOperator,
        requireRole,
        can,
        audit,
        events,
        store: new FsStore(appDir),
        people,
        service: (name) => services[name],
        frame: (req, res, next) => frame()(req, res, next),
        clock: { now: () => Date.now() },
        checksCsrf: true,
        onUpgrade: (path, handler) => upgrades.onUpgrade(path, handler),
      };
    },
  };
}
