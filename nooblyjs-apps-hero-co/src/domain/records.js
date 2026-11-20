// The workspace's own records (stack.md §4.1) on nooblyjs-core's dataService, beside the accounts: services, deploys,
// environment groups and the GitHub connection. The infrastructure accelerator keeps the workloads; these are what a
// customer sees. Every lookup takes the workspace, so no call can return another workspace's record.
//
// Values that are secret (environment variables, the GitHub token) are stored sealed (src/domain/secrets.js) and the
// views below never include them.
import crypto from 'node:crypto';

export const DOMAIN_CONTAINERS = {
  services: 'hero_services',
  deploys: 'hero_deploys',
  envGroups: 'hero_env_groups',
  github: 'hero_github',
};

const now = () => new Date().toISOString();
export const newId = (prefix) => `${prefix}_${crypto.randomBytes(9).toString('base64url').toLowerCase().replace(/[^a-z0-9]/g, '0')}`;

/** A service as the API shows it: environment keys, never values. */
export function serviceView(s) {
  if (!s) return null;
  const { env = [], ...rest } = s;
  return { ...rest, env: env.map((e) => ({ key: e.key })) };
}

export const groupView = (g) => g && ({ id: g.id, name: g.name, vars: (g.vars ?? []).map((v) => ({ key: v.key })), createdAt: g.createdAt, updatedAt: g.updatedAt ?? null });
export const githubView = (c) => c && ({ login: c.login, organisations: c.organisations ?? [], connectedAt: c.connectedAt, connectedBy: c.connectedBy ?? null });

/**
 * @param {{ data: object }} o   a nooblyjs-core dataService
 */
export function createRecords({ data }) {
  const C = DOMAIN_CONTAINERS;
  const all = (container) => data.listAll(container);
  const get = async (container, id) => (id ? (await data.getByUuid(container, id)) ?? null : null);
  const put = (container, record) => data.addWithKey(container, record.id, record);
  const where = async (container, test) => (await all(container)).filter(test);
  const save = async (container, record) => {
    await data.update(container, record.id, record);
    return record;
  };

  async function init() {
    for (const name of Object.values(C)) {
      try {
        await data.createContainer(name);
      } catch (err) {
        if (!/already exists/.test(err.message)) throw err;
      }
    }
  }

  const services = {
    list: (workspaceId) => where(C.services, (s) => s.workspaceId === workspaceId),
    async byName(workspaceId, name) {
      return (await where(C.services, (s) => s.workspaceId === workspaceId && s.name === name))[0] ?? null;
    },
    async create(record) {
      const s = { id: newId('svc'), createdAt: now(), updatedAt: null, ...record };
      await put(C.services, s);
      return s;
    },
    async update(workspaceId, id, patch) {
      const s = await get(C.services, id);
      if (!s || s.workspaceId !== workspaceId) return null;
      const next = typeof patch === 'function' ? patch(s) : { ...s, ...patch };
      if (!next) return s;
      return save(C.services, { ...next, id, workspaceId, updatedAt: now() });
    },
    async remove(workspaceId, id) {
      const s = await get(C.services, id);
      if (s?.workspaceId === workspaceId) await data.remove(C.services, id);
    },
  };

  const deploys = {
    /** Newest first; `serviceId` narrows to one service. */
    async list(workspaceId, { serviceId, limit = 50 } = {}) {
      return (await where(C.deploys, (d) => d.workspaceId === workspaceId && (!serviceId || d.serviceId === serviceId)))
        .sort((a, b) => String(b.startedAt ?? b.createdAt).localeCompare(String(a.startedAt ?? a.createdAt)) || String(b.createdAt).localeCompare(String(a.createdAt)))
        .slice(0, limit);
    },
    async get(workspaceId, id) {
      const d = await get(C.deploys, id);
      return d?.workspaceId === workspaceId ? d : null;
    },
    /** Creates or merges a deploy by its id (the platform's deploy id). */
    async upsert(workspaceId, id, patch) {
      const d = await get(C.deploys, id);
      if (d && d.workspaceId !== workspaceId) return null;
      const next = { ...(d ?? { id, workspaceId, createdAt: now() }), ...patch, id, workspaceId };
      if (d) await save(C.deploys, next);
      else await put(C.deploys, next);
      return next;
    },
    async remove(workspaceId, id) {
      if (await deploys.get(workspaceId, id)) await data.remove(C.deploys, id);
    },
  };

  const envGroups = {
    list: (workspaceId) => where(C.envGroups, (g) => g.workspaceId === workspaceId),
    async get(workspaceId, id) {
      const g = await get(C.envGroups, id);
      return g?.workspaceId === workspaceId ? g : null;
    },
    async create(record) {
      const g = { id: newId('grp'), createdAt: now(), updatedAt: null, vars: [], ...record };
      await put(C.envGroups, g);
      return g;
    },
    async update(workspaceId, id, patch) {
      const g = await envGroups.get(workspaceId, id);
      if (!g) return null;
      return save(C.envGroups, { ...g, ...patch, id, workspaceId, updatedAt: now() });
    },
    async remove(workspaceId, id) {
      if (await envGroups.get(workspaceId, id)) await data.remove(C.envGroups, id);
    },
  };

  const github = {
    get: (workspaceId) => get(C.github, workspaceId),
    async set(workspaceId, record) {
      const existing = await get(C.github, workspaceId);
      const next = { ...record, id: workspaceId };
      if (existing) await save(C.github, next);
      else await put(C.github, next);
      return next;
    },
    async remove(workspaceId) {
      if (await get(C.github, workspaceId)) await data.remove(C.github, workspaceId);
    },
  };

  return { init, services, deploys, envGroups, github };
}
