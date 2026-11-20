// The catalogue the create flow offers (product.md §4, §6.3): instance types, regions, runtimes and which service types
// can be created yet. Shared by the server (validation, the workload spec) and the browser (the form and its Summary),
// so it imports nothing.
//
// Prices are flat per service per month, whatever the instance count up to MAX_INSTANCES (decided 2026-11-20; product.md
// §11). Services that answer requests sleep when idle and wake on the next request, which is what keeps a flat price
// affordable (SLEEP below; the platform does it from roadmap 3.11).

/** Instance types: the CPU and memory reserved for each instance. */
export const PLANS = [
  { key: 'starter', name: 'Starter', cpu: 0.5, memoryMb: 512, priceUsd: 0 },
  { key: 'standard', name: 'Standard', cpu: 1, memoryMb: 2048, priceUsd: 5 },
  { key: 'pro', name: 'Pro', cpu: 2, memoryMb: 4096, priceUsd: 20 },
  { key: 'pro-plus', name: 'Pro Plus', cpu: 4, memoryMb: 8192, priceUsd: 100 },
];
export const DEFAULT_PLAN = 'standard';
export const MAX_INSTANCES = 10;

/** Idle sleep: a service with no requests for `afterMinutes` scales to zero and wakes on the next request. */
export const SLEEP = { afterMinutes: 15, wakeText: 'The first request after a sleep takes a few seconds while it wakes.' };

/**
 * Regions (the mock-up's four). `platform` is the infrastructure accelerator's catalogue region that runs it; a region
 * without one is shown but cannot be chosen yet.
 */
export const REGIONS = [
  // Your own servers on the local network (infra spec 8.9): services run there for real, at <base URL>/<workspace>/<service>.
  { id: 'local', name: 'Local network', platform: 'lan-dev', local: true },
  { id: 'af-south', name: 'Johannesburg', platform: 'af-south-1' },
  { id: 'eu-central', name: 'Frankfurt', platform: null },
  { id: 'us-east', name: 'Virginia', platform: 'us-east-1' },
  { id: 'ap-southeast', name: 'Singapore', platform: null },
];

/** Runtimes, in the mock-up's order, with the accelerator's names (spec 8.1 build.runtime). */
export const RUNTIMES = [
  { key: 'node22', name: 'Node.js 22' },
  { key: 'dockerfile', name: 'Docker (Dockerfile in repo)' },
  { key: 'python312', name: 'Python 3.12' },
  { key: 'go123', name: 'Go 1.23' },
];

/**
 * The service types this phase can create, and what each becomes on the platform. Cron jobs wait for scheduling
 * (core `scheduling` → runJob), workflows for core `workflow`, Postgres and Key Value for infra 8.6 and 8.7, Sandbox
 * Groups for an isolation decision (product.md §11).
 */
export const CREATABLE = {
  web: { kind: 'service', label: 'Web Service', action: 'Deploy web service', port: true, instances: true, publicUrl: true, sleeps: true },
  private: { kind: 'private', label: 'Private Service', action: 'Deploy private service', port: true, instances: true, publicUrl: false, sleeps: true },
  worker: { kind: 'worker', label: 'Background Worker', action: 'Deploy worker', port: false, instances: true, publicUrl: false, sleeps: false },
  static: { kind: 'static', label: 'Static Site', action: 'Deploy static site', port: false, instances: false, publicUrl: true, sleeps: false },
};

export const planOf = (key) => PLANS.find((p) => p.key === key) ?? null;
export const regionOf = (id) => REGIONS.find((r) => r.id === id) ?? null;
export const runtimeOf = (key) => RUNTIMES.find((r) => r.key === key) ?? null;

/** "1 CPU · 2 GB" */
export function specText(plan) {
  const mem = plan.memoryMb >= 1024 ? `${plan.memoryMb / 1024} GB` : `${plan.memoryMb} MB`;
  return `${plan.cpu} CPU · ${mem}`;
}

/** "$0", "$—" while a price is undecided. */
export const priceText = (usd) => (usd === null || usd === undefined ? '$—' : `$${Number.isInteger(usd) ? usd : usd.toFixed(2)}`);

/** The monthly price of a service on a plan: { usd, text }. Flat: the instance count does not change it. */
export function estimate(planKey) {
  const plan = planOf(planKey);
  if (!plan || plan.priceUsd === null) return { usd: null, text: '$— / mo' };
  return { usd: plan.priceUsd, text: `${priceText(plan.priceUsd)} / mo` };
}
