// The browser router: real URLs (product.md §5), history.pushState, same-origin link clicks intercepted, deep links and
// refresh land on the same screen (the server answers every page URL with index.html).

/** Route patterns → { name, layout }. Order matters: first match wins. */
export const ROUTES = [
  { pattern: '/', name: 'marketing', layout: 'public' },
  { pattern: '/forgot-password', name: 'forgot-password', layout: 'public' },
  { pattern: '/reset-password', name: 'reset-password', layout: 'public' },
  { pattern: '/verify-email', name: 'verify-email', layout: 'public' },
  { pattern: '/invite', name: 'invite', layout: 'public' },
  { pattern: '/admin', name: 'admin', layout: 'admin' },
  { pattern: '/w/:workspace', name: 'dashboard', layout: 'workspace' },
  { pattern: '/w/:workspace/new', name: 'new-service', layout: 'workspace' },
  { pattern: '/w/:workspace/new/:type', name: 'new-service-type', layout: 'workspace' },
  { pattern: '/w/:workspace/services/:service', name: 'service', layout: 'workspace' },
  { pattern: '/w/:workspace/projects', name: 'projects', layout: 'workspace' },
  { pattern: '/w/:workspace/deploys', name: 'deploys', layout: 'workspace' },
  { pattern: '/w/:workspace/metrics', name: 'metrics', layout: 'workspace' },
  { pattern: '/w/:workspace/logs', name: 'logs', layout: 'workspace' },
  { pattern: '/w/:workspace/env-groups', name: 'env-groups', layout: 'workspace' },
  { pattern: '/w/:workspace/github', name: 'github', layout: 'workspace' },
  { pattern: '/w/:workspace/billing', name: 'billing', layout: 'workspace' },
  { pattern: '/w/:workspace/settings', name: 'settings', layout: 'workspace' },
];

/**
 * @param {string} pathname
 * @returns {{ name: string, layout: string, params: Record<string, string> } | null}
 */
export function match(pathname) {
  const parts = pathname.replace(/\/+$/, '').split('/').filter(Boolean);
  for (const route of ROUTES) {
    const want = route.pattern.split('/').filter(Boolean);
    if (want.length !== parts.length) continue;
    const params = {};
    const ok = want.every((seg, i) => {
      if (seg.startsWith(':')) {
        params[seg.slice(1)] = decodeURIComponent(parts[i]);
        return true;
      }
      return seg === parts[i];
    });
    if (ok) return { name: route.name, layout: route.layout, params };
  }
  return null;
}

/**
 * Starts the router.
 * @param {(route: ReturnType<typeof match>, url: URL) => void|Promise<void>} onRoute
 */
export function start(onRoute) {
  const go = () => {
    const url = new URL(window.location.href);
    return onRoute(match(url.pathname), url);
  };
  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const a = event.target.closest('a[href]');
    if (!a || a.target || a.hasAttribute('download') || a.dataset.reload !== undefined) return;
    const url = new URL(a.href);
    if (url.origin !== window.location.origin || !match(url.pathname)) return;
    // A link to a section of this page (#id): the browser scrolls to it.
    if (url.hash && url.pathname === window.location.pathname && url.search === window.location.search) return;
    event.preventDefault();
    navigate(url.pathname + url.search);
  });
  window.addEventListener('popstate', go);
  go();

  function navigate(to) {
    if (to !== window.location.pathname + window.location.search) window.history.pushState({}, '', to);
    go();
  }
  return { navigate };
}
