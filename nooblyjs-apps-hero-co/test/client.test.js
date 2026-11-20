// The browser modules that need no DOM: the router's matcher, the charts and the components, run in Node.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { match, ROUTES } from '../public/js/router.js';
import { areaChart, shares, stackedBar } from '../public/js/charts.js';
import { html, raw } from '../public/js/html.js';
import * as c from '../public/js/components/index.js';
import { WORKSPACE_NAV } from '../public/js/shell.js';
import { SERVICE_TYPES as CLIENT_TYPES } from '../public/js/pages/index.js';
import { WORKSPACE_PAGES, SERVICE_TYPES } from '../src/routes/pages.js';

test('the router matches every product.md §5 route and nothing else', () => {
  assert.deepEqual(match('/'), { name: 'marketing', layout: 'public', params: {} });
  assert.deepEqual(match('/w/exclusivity-life'), { name: 'dashboard', layout: 'workspace', params: { workspace: 'exclusivity-life' } });
  assert.deepEqual(match('/w/exclusivity-life/new/web/'), { name: 'new-service-type', layout: 'workspace', params: { workspace: 'exclusivity-life', type: 'web' } });
  assert.deepEqual(match('/w/x/services/api').params, { workspace: 'x', service: 'api' });
  assert.equal(match('/w/x/services'), null);
  assert.equal(match('/infrastructure'), null, 'accelerator pages are full page loads, not client routes');
  assert.equal(match('/admin/customer/'), null);
});

test('client and server agree on the workspace pages, the sidebar and the service types', () => {
  const clientPages = ROUTES.filter((r) => r.layout === 'workspace' && !r.pattern.includes(':type') && !r.pattern.includes(':service'))
    .map((r) => r.pattern.replace('/w/:workspace', ''));
  assert.deepEqual(clientPages.sort(), [...WORKSPACE_PAGES].sort());
  assert.deepEqual(WORKSPACE_NAV.map((n) => n.path).sort(), [...WORKSPACE_PAGES].sort());
  assert.deepEqual(CLIENT_TYPES.map((t) => t.key), SERVICE_TYPES);
  assert.deepEqual(WORKSPACE_NAV.map((n) => n.label), ['Dashboard', 'New service', 'Projects', 'Deploys', 'Metrics', 'Logs', 'Environment groups', 'GitHub', 'Billing', 'Settings']);
});

test('html`` escapes values, keeps nested html and raw(), and joins arrays', () => {
  const name = '<script>alert(1)</script>';
  assert.equal(String(html`<p>${name}</p>`), '<p>&#60;script&#62;alert(1)&#60;/script&#62;</p>');
  assert.equal(String(html`<ul>${['a', 'b'].map((x) => html`<li>${x}</li>`)}</ul>`), '<ul><li>a</li><li>b</li></ul>');
  assert.equal(String(html`${raw('<b>ok</b>')}${null}${false}`), '<b>ok</b>');
});

test('the area chart draws a line, an area and a limit, with the metric\'s class and no inline styles', () => {
  const points = [{ t: 0, value: 0.2 }, { t: 60, value: 0.8 }, { t: 120, value: 0.5 }];
  const svg = areaChart(points, { metric: 'memory', limit: 1, label: 'Memory · last 2 minutes' });
  assert.match(svg, /class="nj-chart nj-chart-memory"/);
  assert.match(svg, /<path class="nj-chart-line" d="M4,/);
  assert.match(svg, /<line class="nj-chart-limit"/);
  assert.match(svg, /aria-label="Memory · last 2 minutes"/);
  assert.doesNotMatch(svg, /style=/);
  assert.match(areaChart([], { metric: 'cpu' }), /<svg[^>]*><line class="nj-chart-grid"/);
  assert.match(areaChart(points, { metric: 'nonsense' }), /nj-chart-cpu/);
});

test('shares add up to exactly 100, and the stacked bar carries them as data-pct', () => {
  // The dashboard mock-up: 7.5 vCPU reserved across services.
  const parts = shares([{ label: 'agents', value: 2 }, { label: 'api', value: 2 }, { label: 'database', value: 2 }, { label: 'records', value: 0.5 }, { label: 'cache', value: 0.5 }, { label: 'orders, etl', value: 0.5 }]);
  assert.equal(parts.reduce((s, p) => s + p.pct, 0), 100);
  assert.deepEqual(parts.map((p) => p.pct), [27, 27, 27, 7, 6, 6]); // largest remainder; ties go to the first
  assert.deepEqual(shares([{ label: 'none', value: 0 }]).map((p) => p.pct), [0]);
  const bar = stackedBar([{ label: 'api', value: 2, unit: 'vCPU' }, { label: '<b>', value: 1 }]);
  assert.match(bar, /data-pct="67"/);
  assert.match(bar, /&#60;b&#62;/);
  assert.doesNotMatch(bar, /style=/);
});

test('components render units and limits, statuses as words, and never an inline style', () => {
  const parts = [
    c.statusPill('Live'), c.statusPill('Deploying'), c.statusPill('Failed'), c.statusPill('Unknown'),
    c.statTile({ label: 'CPU in use', value: '3.1', unit: '/ 7.5 vCPU', caption: '8 services' }),
    c.meter({ label: 'CPU', value: '0.8 of 2 vCPU', pct: 40, metric: 'cpu' }),
    c.optionCard({ icon: 'window', name: 'Web Service', text: 'A dynamic app.', action: 'New web service', href: '/w/x/new/web' }),
    c.optionCard({ icon: 'box', name: 'Sandbox Group', text: 'Isolated compute.', badge: 'Beta', selected: true }),
    c.stepper(['Choose service', 'Connect repo'], 0),
    c.summary({ rows: [['Instance', 'Standard'], ['Estimated', '$— / mo']] }),
    c.repoRow({ owner: 'stevie', name: 'nooblyjs-blog', lang: 'JavaScript', pushed: '2 hours ago', visibility: 'Public', selected: true }),
    c.instanceTile({ id: 'api-7f3a9c', status: 'Healthy', cpu: [0.46, 1], memory: [1.16, 2], uptime: 'Up 12 min · 0 restarts' }),
    c.logViewer({ lines: [{ t: '10:41:02', inst: 'api-7f3a9c', level: 'ERROR', msg: 'boom <x>' }], footer: 'Showing 1 line' }),
    c.logViewer({ lines: [], live: false }),
    c.emptyState({ title: 'No services yet', text: 'Launch one.' }),
  ].map(String);
  const all = parts.join('\n');
  assert.doesNotMatch(all, /style=/);
  assert.match(parts[0], /nj-pill-live">Live</);
  assert.match(parts[2], /nj-pill-failed">Failed</);
  assert.match(parts[3], /nj-pill-idle">Unknown</);
  assert.match(parts[4], /3\.1<span class="nj-stat-unit">\/ 7\.5 vCPU<\/span>/);
  assert.match(parts[5], /aria-valuetext="0\.8 of 2 vCPU"/);
  assert.match(parts[5], /data-pct="40"/);
  assert.match(parts[7], /aria-checked="true"/);
  assert.match(parts[8], /<li class="nj-step" aria-current="step">Choose service<\/li>/);
  assert.match(parts[11], /0\.46 \/ 1 vCPU/);
  assert.match(parts[12], /boom &#60;x&#62;/);
  assert.match(parts[13], /No log lines at this level in the last hour\./);
});

test('the shared catalogue: specs with units, no made-up prices, only open regions choosable', async () => {
  const cat = await import('../public/js/shared/catalog.js');
  const { statusWord } = await import('../public/js/pages/service.js');
  assert.equal(cat.specText(cat.planOf('standard')), '1 CPU · 2 GB');
  assert.equal(cat.specText(cat.planOf('starter')), '0.5 CPU · 512 MB');
  assert.equal(cat.planOf('free'), null, 'no Free plan: Starter is the free one');
  assert.deepEqual(cat.PLANS.map((p) => [p.name, p.priceUsd]), [['Starter', 0], ['Standard', 5], ['Pro', 20], ['Pro Plus', 100]]);
  assert.deepEqual(cat.estimate('pro-plus', 10), { usd: 100, text: '$100 / mo' }, 'flat: instances do not change the price');
  assert.deepEqual(cat.estimate('starter'), { usd: 0, text: '$0 / mo' });
  assert.equal(cat.MAX_INSTANCES, 10);
  assert.deepEqual(Object.entries(cat.CREATABLE).filter(([, t]) => t.sleeps).map(([k]) => k), ['web', 'private']);
  assert.deepEqual(cat.REGIONS.filter((r) => r.platform).map((r) => r.id), ['local', 'af-south', 'us-east']);
  assert.deepEqual(Object.keys(cat.CREATABLE), ['web', 'private', 'worker', 'static']);
  for (const key of Object.keys(cat.CREATABLE)) assert.ok(CLIENT_TYPES.some((t) => t.key === key), key);
  assert.deepEqual(['building', 'live', 'failed', 'superseded'].map(statusWord), ['Building', 'Live', 'Failed', 'Succeeded']);
});
