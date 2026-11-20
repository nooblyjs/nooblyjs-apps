// Charts as SVG strings (no chart library, no inline styles): colours come from CSS classes per metric
// (hero-co.css .nj-chart-<metric>), so metric colours stay fixed as the style guide says. Pure functions: tested in
// Node by test/charts.test.js.

export const METRICS = ['cpu', 'memory', 'requests', 'bandwidth'];
const round = (n) => Math.round(n * 100) / 100;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * An area chart of one metric over time, with an optional dashed limit line.
 * @param {{ t: number, value: number }[]} points   oldest first
 * @param {{ metric?: string, limit?: number, width?: number, height?: number, label?: string }} [o]
 * @returns {string} SVG
 */
export function areaChart(points, { metric = 'cpu', limit, width = 640, height = 200, label = '' } = {}) {
  const pad = 4;
  const cls = METRICS.includes(metric) ? metric : 'cpu';
  const head = `<svg class="nj-chart nj-chart-${cls}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(label || `${cls} over time`)}">`;
  if (!points.length) return `${head}<line class="nj-chart-grid" x1="0" y1="${height - pad}" x2="${width}" y2="${height - pad}"/></svg>`;
  const t0 = points[0].t;
  const t1 = points.at(-1).t;
  const top = Math.max(limit ?? 0, ...points.map((p) => p.value)) || 1;
  const x = (t) => (t1 === t0 ? width / 2 : pad + ((t - t0) / (t1 - t0)) * (width - 2 * pad));
  const y = (v) => height - pad - (v / top) * (height - 2 * pad);
  const coords = points.map((p) => `${round(x(p.t))},${round(y(p.value))}`);
  const line = `M${coords.join(' L')}`;
  const area = `${line} L${round(x(t1))},${height - pad} L${round(x(t0))},${height - pad} Z`;
  const grid = [0.25, 0.5, 0.75].map((f) => `<line class="nj-chart-grid" x1="0" y1="${round(pad + f * (height - 2 * pad))}" x2="${width}" y2="${round(pad + f * (height - 2 * pad))}"/>`).join('');
  const limitLine = limit === undefined ? '' : `<line class="nj-chart-limit" x1="0" y1="${round(y(limit))}" x2="${width}" y2="${round(y(limit))}"/>`;
  return `${head}${grid}<path class="nj-chart-area" d="${area}"/><path class="nj-chart-line" d="${line}"/>${limitLine}</svg>`;
}

/**
 * Shares of a whole (CPU allocated by service): each segment's percentage, rounded so they add up to 100.
 * @param {{ label: string, value: number }[]} segments
 * @returns {{ label: string, value: number, pct: number, index: number }[]}
 */
export function shares(segments) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (!total) return segments.map((s, index) => ({ ...s, pct: 0, index }));
  const exact = segments.map((s) => (s.value / total) * 100);
  const floors = exact.map(Math.floor);
  let left = 100 - floors.reduce((a, b) => a + b, 0);
  const order = exact.map((e, i) => [e - floors[i], i]).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) {
    if (left <= 0) break;
    floors[i] += 1;
    left -= 1;
  }
  return segments.map((s, index) => ({ ...s, pct: floors[index], index }));
}

/**
 * A stacked bar with a legend. Widths are set from data-pct by applySizes() (CSSOM), not inline styles.
 * @param {{ label: string, value: number, unit?: string }[]} segments
 * @param {{ label?: string }} [o]
 * @returns {string} HTML
 */
export function stackedBar(segments, { label = 'Share' } = {}) {
  const parts = shares(segments);
  const bar = parts.map((p) => `<div class="nj-stack-seg nj-stack-seg-${p.index % 6}" data-pct="${p.pct}" title="${esc(p.label)}"></div>`).join('');
  const legend = parts.map((p) => `<li><span class="nj-legend-swatch nj-stack-seg-${p.index % 6}" aria-hidden="true"></span>${esc(p.label)} · <span class="nj-num">${esc(p.value)}${p.unit ? ` ${esc(p.unit)}` : ''}</span></li>`).join('');
  return `<div class="nj-stack" role="img" aria-label="${esc(label)}">${bar}</div><ul class="nj-legend">${legend}</ul>`;
}

/** Sets widths from data-pct (meters and stacked bars) through the CSSOM, which the CSP allows. */
export function applySizes(root) {
  for (const el of root.querySelectorAll('[data-pct]')) {
    const pct = Math.max(0, Math.min(100, Number(el.dataset.pct) || 0));
    el.style.width = `${pct}%`;
  }
}
