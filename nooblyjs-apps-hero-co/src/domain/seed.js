// The seed story's hero-co half (roadmap 2.8): on top of the infrastructure accelerator's seed (workloads and deploys
// of exclusivity-life), the services a customer sees for them, their deploy records, a GitHub connection as stevie on
// the mock GitHub, and the database and cache (records only: the platform runs them from 8.6 and 8.7).
import { PLANS, REGIONS } from '../../public/js/shared/catalog.js';
import { fromPlatformDeploy } from '../platform/workloads.js';
import { mockTokenFor, MOCK_ORGS } from '../github/mock-data.js';

export const SEED_WORKSPACE = 'exclusivity-life';
const TYPE_OF_KIND = { service: 'web', private: 'private', worker: 'worker', static: 'static', job: 'cron' };
const DEMO = { NODE_ENV: 'production', LOG_LEVEL: 'info' };

/** The plan nearest a workload's { cpu, memoryMb }. */
function planFor({ cpu, memoryMb } = {}) {
  const exact = PLANS.find((p) => p.cpu === cpu && p.memoryMb === memoryMb);
  if (exact) return exact.key;
  return PLANS.reduce((best, p) => (Math.abs(p.cpu - cpu) < Math.abs(best.cpu - cpu) ? p : best), PLANS.find((p) => p.key === 'standard')).key;
}

/**
 * @param {object} o
 * @param {boolean} [o.reset]  replace the workspace's services, deploys, groups and GitHub connection
 * @returns {Promise<{ services: number, deploys: number, skipped?: string }>}
 */
export async function seedRecords({ records, secrets, platform, accounts, reset = false }) {
  const ws = SEED_WORKSPACE;
  if (!(await accounts.getWorkspace(ws))) return { services: 0, deploys: 0, skipped: `no workspace ${ws}` };
  const existing = await records.services.list(ws);
  if (existing.length && !reset) return { services: 0, deploys: 0, skipped: 'already seeded' };
  if (reset) {
    for (const s of existing) await records.services.remove(ws, s.id);
    for (const d of await records.deploys.list(ws, { limit: 10_000 })) await records.deploys.remove(ws, d.id);
    for (const g of await records.envGroups.list(ws)) await records.envGroups.remove(ws, g.id);
    await records.github.remove(ws);
  }

  const stevie = { id: 'stevie', name: 'Stevie' };
  await records.github.set(ws, {
    login: 'stevie', organisations: MOCK_ORGS.stevie ?? [], tokenSealed: secrets.seal(mockTokenFor('stevie'), `github:${ws}`),
    connectedAt: new Date(Date.now() - 21 * 86_400_000).toISOString(), connectedBy: stevie,
  });

  const listed = await platform().workloads.list(ws).catch(() => []);
  const workloads = Array.isArray(listed) ? listed : listed.workloads ?? [];
  let deployCount = 0;
  for (const w of workloads) {
    const type = TYPE_OF_KIND[w.kind] ?? 'web';
    const svc = await records.services.create({
      workspaceId: ws, name: w.name, type,
      source: { provider: 'github', repo: w.source?.repo ?? null, branch: w.source?.branch ?? 'main', rootDir: w.source?.rootDir ?? '' },
      build: { runtime: w.build?.runtime ?? 'node22', buildCommand: w.build?.buildCommand ?? null, startCommand: w.build?.startCommand ?? null },
      region: REGIONS.find((r) => r.platform === w.region)?.id ?? 'af-south',
      plan: planFor(w.plan), instances: w.instances ?? 1,
      envGroups: [], autoDeploy: Boolean(w.autoDeploy),
      url: w.domains?.length ? `https://${w.domains[0]}` : null,
      internalHost: w.kind === 'private' ? `${w.name}:${w.run?.port ?? 10000}` : null,
      status: w.status ?? 'live', current: w.current ? { deployId: w.current.deployId, commit: w.current.commit } : null, workload: w.name,
      createdBy: stevie, createdAt: w.createdAt ?? new Date().toISOString(),
    });
    // Plain values become sealed variables of ours; links (database, cache) wait for 8.6 and 8.7.
    const env = (w.run?.env ?? []).filter((e) => typeof e.value === 'string' || DEMO[e.key])
      .map((e) => ({ key: e.key, sealed: secrets.seal(e.value ?? DEMO[e.key], `svc:${svc.id}:${e.key}`) }));
    await records.services.update(ws, svc.id, { env });
    const { deploys } = await platform().deploys.list(ws, w.name, { limit: 20 }).catch(() => ({ deploys: [] }));
    for (const d of deploys) {
      await records.deploys.upsert(ws, d.id, { ...fromPlatformDeploy(d), serviceId: svc.id, serviceName: w.name, step: d.result === 'live' ? 3 : null, of: 3 });
      deployCount += 1;
    }
  }

  // The data stores of the story: shown, not run yet.
  for (const [name, type, plan] of [['database', 'postgres', 'standard'], ['cache', 'keyvalue', 'starter']]) {
    await records.services.create({
      workspaceId: ws, name, type, source: null, build: null, region: 'af-south', plan, instances: 1, env: [], envGroups: [],
      autoDeploy: false, url: null, internalHost: `${name}:${type === 'postgres' ? 5432 : 6379}`, status: 'live', current: null, workload: null, createdBy: stevie,
    });
  }
  return { services: workloads.length + 2, deploys: deployCount };
}
