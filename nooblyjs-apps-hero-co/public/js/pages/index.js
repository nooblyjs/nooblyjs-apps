// Every screen of product.md §5. Phase 0 draws each one's title and an empty state that says which phase builds it;
// later phases replace a page's render() with the real screen.
import { html } from '../html.js';
import { api } from '../api.js';
import { emptyState, optionCard, statusPill, stepper } from '../components/index.js';
import { signUpPage, forgotPasswordPage, resetPasswordPage, verifyEmailPage, invitePage } from './account.js';
import { settingsPage } from './settings.js';
import { createServicePage, comingTypePage } from './create.js';
import { servicePage, statusWord } from './service.js';
import { envGroupsPage } from './env-groups.js';
import { githubPage } from './github.js';
import { CREATABLE } from '../shared/catalog.js';

/** Service types (product.md §6.2), in the order of the Create a new service screen. Copy verbatim from the mock-up. */
export const SERVICE_TYPES = [
  { key: 'static', group: 'apps', name: 'Static Site', icon: 'globe2', action: 'New static site', text: 'Static content served over a global CDN. For frontends, blogs and content sites.' },
  { key: 'web', group: 'apps', name: 'Web Service', icon: 'window', action: 'New web service', text: 'A dynamic app on a public HTTPS URL. For full-stack apps, APIs and mobile backends.' },
  { key: 'private', group: 'apps', name: 'Private Service', icon: 'shield-lock', action: 'New private service', text: 'An app on the private network, reachable only from your other services.' },
  { key: 'worker', group: 'apps', name: 'Background Worker', icon: 'gear-wide-connected', action: 'New worker', text: 'A long-running process that works through async jobs, usually from a queue.' },
  { key: 'cron', group: 'apps', name: 'Cron Job', icon: 'clock-history', action: 'New cron job', text: 'A short task that runs on a schedule you set, then stops.' },
  { key: 'workflow', group: 'apps', name: 'Workflow', icon: 'diagram-3', action: 'New workflow', text: 'Run many parallel tasks with retries, without managing the machines.' },
  { key: 'postgres', group: 'data', name: 'Postgres', icon: 'database', action: 'New Postgres', text: 'Managed relational database with point-in-time recovery, read replicas and high availability.' },
  { key: 'keyvalue', group: 'data', name: 'Key Value', icon: 'lightning-charge', action: 'New Key Value instance', text: 'Managed Redis-compatible store. Use it as a shared cache, message broker or job queue.' },
  { key: 'sandbox', group: 'data', name: 'Sandbox Group', icon: 'box', action: 'New sandbox group', badge: 'Beta', text: 'Isolated, short-lived compute for running untrusted code, such as code your agents write.' },
];

const typeOf = (key) => SERVICE_TYPES.find((t) => t.key === key);

function head({ eyebrow, title, lead, actions = '' }) {
  return html`<div class="nj-page-head">
    <div>${eyebrow ? html`<p class="nj-breadcrumb">${eyebrow}</p>` : ''}<h1 class="nj-title">${title}</h1>${lead ? html`<p class="nj-lead">${lead}</p>` : ''}</div>
    ${actions}
  </div>`;
}

const coming = (phase, what) => emptyState({ icon: 'cone-striped', title: `Coming in ${phase}`, text: what });

/** name → ({ params, me, workspace }) => { title, content } (title is the document title). */
export const PAGES = {
  dashboard: async ({ workspace }) => {
    const id = encodeURIComponent(workspace.id);
    const [ws, { services }, github] = await Promise.all([
      api(`/api/v1/workspaces/${id}`), api(`/api/v1/workspaces/${id}/services`), api(`/api/v1/workspaces/${id}/github`),
    ]);
    const env = ws.projects.find((p) => p.isDefault)?.environments.find((e) => e.name === 'Production');
    const lead = `${services.length} service${services.length === 1 ? '' : 's'}${env ? ` · ${env.regionName} (${env.region})` : ''} · ${github.connected ? `GitHub: ${github.login}` : 'not connected to GitHub yet'}`;
    const actions = html`<a class="btn btn-primary" href="/w/${workspace.id}/new">New service</a>`;
    if (services.length) {
      return {
        title: `Production · ${workspace.name}`,
        content: html`${head({ eyebrow: workspace.name, title: 'Production', lead, actions })}
          <section class="nj-card" aria-labelledby="svc-title"><h2 class="nj-card-title" id="svc-title">Services</h2>
          <div class="table-responsive"><table class="table mb-0"><caption class="visually-hidden">Services</caption>
            <thead><tr><th scope="col">Name</th><th scope="col">Type</th><th scope="col">Status</th><th scope="col">Repo</th></tr></thead>
            <tbody>${services.map((s) => html`<tr><td><a href="/w/${workspace.id}/services/${s.name}">${s.name}</a></td><td>${CREATABLE[s.type]?.label ?? typeOf(s.type)?.name ?? s.type}</td><td>${statusPill(statusWord(s.status))}</td><td class="nj-meta">${s.source?.repo ?? '—'}</td></tr>`)}</tbody>
          </table></div></section>
          <p class="nj-meta mt-3">Stats, resources and recent deploys arrive here in Phase 4.</p>`,
      };
    }
    return {
    title: `Production · ${workspace.name}`,
    content: html`${head({ eyebrow: workspace.name, title: 'Production', lead, actions })}${emptyState({
      icon: 'rocket-takeoff',
      title: 'No services yet',
      text: 'Launch your first service from a GitHub repo. Stats, the services list and recent deploys appear here (Phase 4).',
      action: html`<a class="btn btn-primary" href="/w/${workspace.id}/new">New service</a>`,
    })}`,
    };
  },

  'new-service': ({ workspace }) => ({
    title: `New service · ${workspace.name}`,
    content: html`${head({ eyebrow: `${workspace.name} · Production`, title: 'What are you launching?', lead: 'Pick a service type. You will connect a GitHub repo in the next step.', actions: html`<a class="btn btn-secondary" href="#which-one">Which one should I use?</a>` })}
      ${stepper(['Choose service', 'Connect repo', 'Configure', 'Deploy'], 0)}
      <h2 class="nj-section-title">Apps and services</h2>
      <div class="nj-options mb-5">${SERVICE_TYPES.filter((t) => t.group === 'apps').map((t) => optionCard({ ...t, href: `/w/${workspace.id}/new/${t.key}` }))}</div>
      <h2 class="nj-section-title">Data and compute</h2>
      <div class="nj-options">${SERVICE_TYPES.filter((t) => t.group === 'data').map((t) => optionCard({ ...t, href: `/w/${workspace.id}/new/${t.key}` }))}</div>
      <section class="nj-card mt-5" id="which-one" tabindex="-1" aria-labelledby="which-title">
        <h2 class="nj-card-title" id="which-title">Which one should I use?</h2>
        <dl class="nj-help mb-0">
          <div><dt>People visit it in a browser, or other apps call its API</dt><dd>A <a href="/w/${workspace.id}/new/web">Web Service</a>. If it is only HTML, CSS and JavaScript after a build, a <a href="/w/${workspace.id}/new/static">Static Site</a> is cheaper and faster.</dd></div>
          <div><dt>Only your other services call it</dt><dd>A <a href="/w/${workspace.id}/new/private">Private Service</a>: it has no public URL.</dd></div>
          <div><dt>It works through a queue and never answers requests</dt><dd>A <a href="/w/${workspace.id}/new/worker">Background Worker</a>.</dd></div>
          <div><dt>It runs on a schedule, then stops</dt><dd>A Cron Job (coming soon).</dd></div>
          <div><dt>You need somewhere to keep data</dt><dd>Postgres for records, Key Value for a cache or queue (both coming soon).</dd></div>
        </dl>
      </section>`,
  }),

  'new-service-type': (ctx) => {
    const typeInfo = typeOf(ctx.params.type);
    return CREATABLE[typeInfo.key] ? createServicePage({ ...ctx, typeInfo }) : comingTypePage({ ...ctx, typeInfo });
  },

  service: servicePage,

  projects: async ({ workspace }) => {
    const ws = await api(`/api/v1/workspaces/${encodeURIComponent(workspace.id)}`);
    return {
      title: `Projects · ${workspace.name}`,
      content: html`${head({ eyebrow: workspace.name, title: 'Projects', lead: 'Group services by product. Each project has its own environments.' })}
        <div class="nj-accelerators">${ws.projects.map((p) => html`<section class="nj-card">
          <div class="d-flex justify-content-between align-items-start gap-2"><h2 class="nj-card-title">${p.name}</h2>${p.isDefault ? html`<span class="nj-meta">Default</span>` : ''}</div>
          <ul class="list-unstyled mb-0">${p.environments.map((e) => html`<li class="d-flex justify-content-between"><span>${e.name}</span><span class="nj-meta">${e.regionName} (${e.region}) · 0 services</span></li>`)}</ul>
        </section>`)}</div>
        <p class="nj-meta mt-4">More projects and a Staging environment come later: there is no design for them yet.</p>`,
    };
  },
  deploys: ({ workspace }) => simple(workspace, 'Deploys', 'Every deploy in this workspace: commit, trigger, status and when.', 'Phase 4'),
  metrics: ({ workspace }) => simple(workspace, 'Metrics', 'CPU, memory, requests and bandwidth across every service.', 'Phase 4'),
  logs: ({ workspace }) => simple(workspace, 'Logs', 'Live and historical logs from every service, filtered by level.', 'Phase 4'),
  'env-groups': envGroupsPage,
  github: githubPage,
  billing: ({ workspace }) => simple(workspace, 'Billing', 'Your plan, usage this month, cards and invoices.', 'Phase 7'),
  settings: settingsPage,

  marketing: (ctx) => signUpPage({ ...ctx, serviceTypes: SERVICE_TYPES }),
  'forgot-password': forgotPasswordPage,
  'reset-password': resetPasswordPage,
  'verify-email': verifyEmailPage,
  invite: invitePage,

  admin: async () => {
    const { items } = await api('/api/v1/admin/accelerators');
    return {
      title: 'Operator · NooblyJS Cloud',
      content: html`${head({ eyebrow: 'Operator', title: 'Back office', lead: 'The accelerators NooblyJS Cloud runs on. Customers never see these screens.' })}
        <div class="nj-accelerators">${items.map((a) => html`<section class="nj-card">
          <div class="d-flex justify-content-between align-items-start gap-2"><h2 class="nj-card-title">${a.label}</h2>${statusPill(a.state === 'mounted' ? 'Live' : 'Idle')}</div>
          <p class="nj-meta mb-3">${a.state === 'mounted' ? `Mounted${a.version ? ` · v${a.version}` : ''}` : a.reason}</p>
          ${a.links.map((href) => html`<a class="btn btn-secondary btn-sm me-2" href="${href}" data-reload>Open ${href}</a>`)}
        </section>`)}</div>`,
    };
  },
};

function simple(workspace, title, lead, phase) {
  return {
    title: `${title} · ${workspace.name}`,
    content: html`${head({ eyebrow: workspace.name, title, lead })}${coming(phase, lead)}`,
  };
}

export function notFound() {
  return {
    title: 'Not found · NooblyJS Cloud',
    content: html`<section class="nj-hero">${emptyState({ icon: 'signpost-split', title: 'There is nothing here', text: 'The page may have moved, or you may not have access to it.', action: html`<a class="btn btn-secondary" href="/">Go home</a>` })}</section>`,
  };
}
