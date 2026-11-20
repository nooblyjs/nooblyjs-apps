// The three layouts: public (marketing, sign-in), workspace (top bar + sidebar from product.md §5) and admin
// (operators). Each wraps a page's content.
import { html } from './html.js';
import { LOGIN_PAGE } from './login.js';

/** The workspace sidebar (product.md §5), in order. `path` is relative to /w/:workspace. */
export const WORKSPACE_NAV = [
  { key: 'dashboard', label: 'Dashboard', path: '', icon: 'grid-1x2' },
  { key: 'new-service', label: 'New service', path: '/new', icon: 'plus-lg' },
  { key: 'projects', label: 'Projects', path: '/projects', icon: 'folder2' },
  { key: 'deploys', label: 'Deploys', path: '/deploys', icon: 'rocket-takeoff' },
  { key: 'metrics', label: 'Metrics', path: '/metrics', icon: 'graph-up' },
  { key: 'logs', label: 'Logs', path: '/logs', icon: 'terminal' },
  { key: 'env-groups', label: 'Environment groups', path: '/env-groups', icon: 'sliders' },
  { key: 'github', label: 'GitHub', path: '/github', icon: 'github' },
  { key: 'billing', label: 'Billing', path: '/billing', icon: 'credit-card' },
  { key: 'settings', label: 'Settings', path: '/settings', icon: 'gear' },
];

/** Which sidebar row is current for a route (service pages sit under Dashboard, new-service types under New service). */
const NAV_FOR = { 'new-service-type': 'new-service', service: 'dashboard' };

const initial = (name) => (name?.trim()?.[0] ?? '?').toUpperCase();

function signOut() {
  return html`<button type="button" class="btn btn-link btn-sm" data-action="signout">Sign out</button>`;
}

/** Until the email is verified (product.md §6.1): a quiet banner with a resend button. */
function verifyBanner(me) {
  if (me.emailVerified) return '';
  return html`<div class="nj-banner" role="status">
    <i class="bi bi-envelope-check" aria-hidden="true"></i>
    <span>Verify your email: we sent a link to <strong>${me.email}</strong>.</span>
    <button type="button" class="btn btn-link btn-sm" data-action="resend-verify">Send it again</button>
  </div>`;
}

function switcher(me, current) {
  const others = me.workspaces.filter((w) => w.id !== current.id);
  const label = html`<span class="nj-avatar" aria-hidden="true">${initial(current.name)}</span><span>${current.name}</span>`;
  if (!others.length) return html`<span class="nj-workspace-switch">${label}</span>`;
  return html`<details class="nj-switcher">
    <summary class="nj-workspace-switch">${label} <i class="bi bi-chevron-down" aria-hidden="true"></i></summary>
    <ul class="nj-switcher-menu">${others.map((w) => html`<li><a href="/w/${w.id}">${w.name}</a></li>`)}</ul>
  </details>`;
}

/**
 * @param {object} o
 * @param {object} o.me           /api/v1/me
 * @param {{ id: string, name: string }} o.workspace
 * @param {string} o.routeName
 * @param {unknown} o.content
 */
export function workspaceLayout({ me, workspace, routeName, content }) {
  const currentKey = NAV_FOR[routeName] ?? routeName;
  return html`<div class="nj-app">
    <header class="nj-topbar">
      <a class="nj-brand" href="/w/${workspace.id}">NooblyJS Cloud</a>
      ${switcher(me, workspace)}
      <span class="nj-topbar-spacer"></span>
      <span class="nj-meta d-none d-sm-inline">${me.name}</span>
      ${signOut()}
    </header>
    <div class="nj-body">
      <nav class="nj-sidebar" aria-label="Workspace">
        <p class="nj-eyebrow nj-sidebar-heading">Workspace</p>
        <ul class="nj-nav">
          ${WORKSPACE_NAV.map((item) => html`<li><a href="/w/${workspace.id}${item.path}"${item.key === currentKey ? html` aria-current="page"` : ''}><i class="bi bi-${item.icon}" aria-hidden="true"></i>${item.label}</a></li>`)}
        </ul>
      </nav>
      <main class="nj-main" id="main" tabindex="-1">${verifyBanner(me)}${content}</main>
    </div>
  </div>`;
}

/** @param {{ me: object|null, content: unknown }} o */
export function publicLayout({ me, content }) {
  const home = me ? (me.operator ? '/admin' : `/w/${me.workspaces[0]?.id ?? ''}`) : null;
  return html`<div class="nj-public">
    <header class="nj-public-bar">
      <a class="nj-brand" href="/">NooblyJS Cloud</a>
      <span class="nj-topbar-spacer"></span>
      <a href="/#product">Product</a><a href="/#docs">Docs</a><a href="/#pricing">Pricing</a>
      ${home ? html`<a class="btn btn-primary btn-sm" href="${home}">Open dashboard</a>` : html`<a class="btn btn-secondary btn-sm" href="${LOGIN_PAGE}">Sign in</a>`}
    </header>
    <main id="main" tabindex="-1">${content}</main>
  </div>`;
}

/** @param {{ me: object, content: unknown }} o */
export function adminLayout({ me, content }) {
  return html`<div class="nj-app">
    <header class="nj-topbar">
      <a class="nj-brand" href="/admin">NooblyJS Cloud</a>
      <span class="nj-pill nj-pill-new">Operator</span>
      <span class="nj-topbar-spacer"></span>
      <span class="nj-meta d-none d-sm-inline">${me.name}</span>
      ${signOut()}
    </header>
    <main class="nj-main" id="main" tabindex="-1">${content}</main>
  </div>`;
}
