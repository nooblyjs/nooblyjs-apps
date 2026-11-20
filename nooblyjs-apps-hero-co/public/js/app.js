// Boot: who am I and how sign-in is set up, then route. Each route picks a layout and a page; the page's content goes
// in the layout's main, then its mount() binds forms and loads anything slow.
import { render } from './html.js';
import { api, ApiError } from './api.js';
import { start } from './router.js';
import { connect } from './sse.js';
import { loginUrl } from './login.js';
import { applySizes } from './charts.js';
import { workspaceLayout, publicLayout, adminLayout } from './shell.js';
import { PAGES, SERVICE_TYPES, notFound } from './pages/index.js';

const root = document.getElementById('app');
let me = null;
/** What the current page's mount() returned to undo (live-channel listeners), run before the next page. */
let unmount = null;
let config = { github: false, devSignIn: false, passwordHint: 'Use 12 or more characters with a number.' };

async function loadMe() {
  try {
    me = await api('/api/v1/me');
    connect();
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 401) throw err;
    me = null;
  }
}

async function loadConfig() {
  try {
    config = await api('/api/v1/auth/config');
  } catch { /* keep the defaults */ }
}

async function show(layoutHtml, page) {
  unmount?.();
  unmount = null;
  document.title = page.title;
  render(root, layoutHtml);
  applySizes(root);
  root.querySelector('#main')?.focus({ preventScroll: true });
  const undo = await page.mount?.(root);
  if (typeof undo === 'function') unmount = undo;
  applySizes(root);
}

const missing = () => notFound();

async function onRoute(route, url) {
  try {
    if (!route) return show(publicLayout({ me, content: missing().content }), missing());
    const ctx = { params: route.params, me, config, url };

    if (route.layout === 'public') {
      const page = await PAGES[route.name](ctx);
      return show(publicLayout({ me, content: page.content }), page);
    }

    if (!me) {
      window.location.assign(loginUrl(url.pathname + url.search));
      return undefined;
    }

    if (route.layout === 'admin') {
      if (!me.operator) return show(publicLayout({ me, content: missing().content }), missing());
      const page = await PAGES[route.name](ctx);
      return show(adminLayout({ me, content: page.content }), page);
    }

    const workspace = me.workspaces.find((w) => w.id === route.params.workspace);
    const unknownType = route.name === 'new-service-type' && !SERVICE_TYPES.some((t) => t.key === route.params.type);
    if (!workspace || unknownType) return show(publicLayout({ me, content: missing().content }), missing());
    const page = await PAGES[route.name]({ ...ctx, workspace });
    return show(workspaceLayout({ me, workspace, routeName: route.name, content: page.content }), page);
  } catch (err) {
    console.error(err);
    render(root, '<p class="nj-meta p-4">Something went wrong loading this page. Reload to try again.</p>');
    return undefined;
  }
}

// Buttons any layout may carry.
document.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  if (button.dataset.action === 'signout') {
    button.disabled = true;
    try {
      await api('/api/v1/auth/signout', { method: 'POST' });
    } finally {
      window.location.assign('/');
    }
  }
  if (button.dataset.action === 'resend-verify') {
    button.disabled = true;
    try {
      const result = await api('/api/v1/auth/verify-email/resend', { method: 'POST' });
      button.textContent = result.verified ? 'Already verified' : 'Sent';
    } catch (err) {
      button.textContent = err.status === 429 ? 'Wait a little and try again' : 'Could not send';
      button.disabled = false;
    }
  }
});

await Promise.all([loadMe(), loadConfig()]);
start(onRoute);
