// Mounts the three accelerators the same way, mount(app, eventEmitter, serviceRegistry, options) (stack.md §3.5):
// customers → payments → infrastructure, and shuts them down in reverse. Everything is checked before anything is
// mounted, so a bad start leaves the app without half an accelerator.
//
//   customers       /admin/customer/, /admin/marketing/   operator back office (stack.md §3.3)
//   payments        /admin/payments/                      not built yet: reported as pending (payments roadmap Phase 0)
//   infrastructure  /infrastructure/                      operator control plane (stack.md §3.2)
import path from 'node:path';
import { INFRA_HOST_NEEDS } from './host.js';

export const INFRA_MOUNT = '/infrastructure';
export const CX_BASE = '/admin';
/** Customers' public routes (tracking, unsubscribe, webhooks): no sign-in. */
export const CX_PUBLIC = `${CX_BASE}/marketing/p`;

async function importOptional(name) {
  try {
    return await import(name);
  } catch (err) {
    if (err.code === 'ERR_MODULE_NOT_FOUND' && String(err.message).includes(`'${name}'`)) return null;
    throw err;
  }
}

/**
 * @param {object} o
 * @param {import('express').Express} o.app
 * @param {import('node:events').EventEmitter} o.eventEmitter
 * @param {object} o.serviceRegistry     nooblyjs-core, initialised
 * @param {object} o.infraHost           the host from createHost().hostFor(<dataDir>/infrastructure)
 * @param {object} o.shell               nooblyjs-core's shell (the operator frame and rail)
 * @param {string} o.dataDir
 * @param {object} o.config              loadConfig()
 * @param {object} [o.log]
 * @param {number} [o.mockStepMs]        passed to the infrastructure accelerator (tests pass 0)
 * @param {number} [o.jobCheckMs]
 * @param {(tenantId: string, refs: string[]) => Promise<Record<string, string>>} [o.resolveSecrets]   opens our secretRefs at deploy (infra 8.9 R9)
 */
export async function mountAccelerators({ app, eventEmitter, serviceRegistry, infraHost, shell, dataDir, config, log = console, mockStepMs, jobCheckMs, resolveSecrets }) {
  // Check before mounting anything.
  if (typeof eventEmitter?.emit !== 'function') throw new Error('mountAccelerators needs the shared EventEmitter.');
  if (!serviceRegistry?.initialized) throw new Error('mountAccelerators needs an initialised serviceRegistry.');
  const missing = INFRA_HOST_NEEDS.filter((key) => !infraHost?.[key]);
  if (missing.length) throw new Error(`The infrastructure host is missing ${missing.join(', ')}; nothing was mounted.`);

  const [customersModule, paymentsModule, infrastructureModule] = await Promise.all([
    import('nooblyjs-accel-customers'),
    importOptional('nooblyjs-accel-payments'),
    import('nooblyjs-accelerator-infrastructure'),
  ]);
  const customers = customersModule.default ?? customersModule;

  const mounted = {};
  const pending = [];
  const closeAll = async () => {
    for (const name of ['infrastructure', 'payments', 'customers']) {
      try {
        await mounted[name]?.shutdown?.();
      } catch (err) {
        log.warn?.(`shutdown of ${name} failed: ${err.message}`);
      }
    }
  };

  try {
    mounted.customers = await customers.mount(app, eventEmitter, serviceRegistry, {
      modules: ['customer', 'marketing'],
      basePath: CX_BASE,
      containerPrefix: 'cx',
      auth: { roleResolver: (req) => req.person?.cxRoles ?? [] },
      seed: !config.production,
      marketing: {
        tracking: { baseUrl: config.publicUrl, signingSecret: config.cxTrackingSecret },
        dispatch: { concurrency: 1 },
      },
    });

    if (paymentsModule) {
      mounted.payments = await paymentsModule.mount(app, eventEmitter, serviceRegistry, {
        modules: ['payments', 'billing'],
        basePath: CX_BASE,
        containerPrefix: 'pay',
        customers: mounted.customers,
        auth: { roleResolver: (req) => req.person?.cxRoles ?? [] },
      });
    } else {
      pending.push({ name: 'payments', reason: 'Not built yet: nooblyjs-accel-payments roadmap Phase 0.' });
    }

    const infrastructure = await infrastructureModule.mount(app, eventEmitter, serviceRegistry, {
      mountPath: INFRA_MOUNT,
      dataDir: path.join(dataDir, 'infrastructure'),
      host: infraHost,
      // Platform hosting (the accelerator's phase 8); environment values are opened by us when a container starts.
      platform: { enabled: true, resolveSecrets },
      // The Local network region (infra spec 8.9): site lan-dev, and in development an agent on this machine.
      local: {
        // Tests take the top of the host port range, so they never meet a development instance on this machine.
        site: { id: 'lan-dev', name: 'Local network', bind: '127.0.0.1', ...(config.localAgent === 'mock' ? { ports: { min: 29000, max: 29999 } } : {}) },
        agent: config.localAgent === 'off' ? null : config.localAgent,
        controller: `http://127.0.0.1:${config.port}`,
      },
      ...(mockStepMs === undefined ? {} : { mockStepMs }),
      ...(jobCheckMs === undefined ? {} : { jobCheckMs }),
    });
    mounted.infrastructure = infrastructure;
    shell.add(infrastructure, { name: infrastructure.name, mountPath: INFRA_MOUNT });
  } catch (err) {
    await closeAll();
    throw err;
  }

  return {
    mounted,
    pending,
    /** What the admin page shows. */
    describe: () => [
      { name: 'customers', label: 'Customers', state: 'mounted', links: [`${CX_BASE}/customer/`, `${CX_BASE}/marketing/`], version: mounted.customers.version },
      ...(mounted.payments
        ? [{ name: 'payments', label: 'Payments', state: 'mounted', links: [`${CX_BASE}/payments/`], version: mounted.payments.version }]
        : pending.map((p) => ({ name: p.name, label: 'Payments', state: 'pending', reason: p.reason, links: [] }))),
      { name: 'infrastructure', label: mounted.infrastructure.title, state: 'mounted', links: [`${INFRA_MOUNT}/`] },
    ],
    shutdown: closeAll,
  };
}
