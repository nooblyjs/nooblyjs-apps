// The .nj- components every screen uses (hero-co.css). Each returns safe HTML from html``.
// Numbers always come with units and limits (product.md §3.2); statuses are words as well as colours.
import { html } from '../html.js';

/** status → pill tone (product.md §6.4). */
export const STATUS_TONE = {
  Live: 'live', Healthy: 'live', Succeeded: 'idle',
  Deploying: 'deploying', Building: 'deploying', Slow: 'deploying',
  Failed: 'failed', Error: 'failed',
  Suspended: 'idle', Idle: 'idle', Sleeping: 'idle',
  New: 'new', Beta: 'new', Invited: 'new',
};

export function statusPill(status) {
  return html`<span class="nj-pill nj-pill-${STATUS_TONE[status] ?? 'idle'}">${status}</span>`;
}

/** @param {{ label: string, value: string|number, unit?: string, caption?: string }} o */
export function statTile({ label, value, unit, caption }) {
  return html`<div class="nj-stat">
    <div class="nj-stat-label">${label}</div>
    <div class="nj-stat-value">${value}${unit ? html`<span class="nj-stat-unit">${unit}</span>` : ''}</div>
    ${caption ? html`<div class="nj-stat-caption">${caption}</div>` : ''}
  </div>`;
}

/**
 * @param {{ label: string, value: string, pct: number, metric?: 'cpu'|'memory'|'requests'|'bandwidth' }} o
 *   value is the text with units and limit, e.g. "0.8 of 2 vCPU"
 */
export function meter({ label, value, pct, metric = 'requests' }) {
  return html`<div class="nj-meter-row">
    <div class="nj-meter-head"><span>${label}</span><span>${value}</span></div>
    <div class="nj-meter nj-meter-${metric}" role="meter" aria-label="${label}" aria-valuenow="${Math.round(pct)}" aria-valuemin="0" aria-valuemax="100" aria-valuetext="${value}">
      <div class="nj-meter-fill" data-pct="${pct}"></div>
    </div>
  </div>`;
}

/** @param {{ icon: string, name: string, text: string, action?: string, href?: string, badge?: string, selected?: boolean }} o */
export function optionCard({ icon, name, text, action, href, badge, selected = false }) {
  const body = html`<span class="nj-option-icon" aria-hidden="true"><i class="bi bi-${icon}"></i></span>
    <span class="nj-option-name">${name} ${badge ? statusPill(badge) : ''}</span>
    <span class="nj-option-text">${text}</span>
    ${action ? html`<span class="btn btn-secondary btn-sm">${action}</span>` : ''}`;
  return href
    ? html`<a class="nj-option text-decoration-none" href="${href}">${body}</a>`
    : html`<button type="button" class="nj-option" role="radio" aria-checked="${selected}">${body}</button>`;
}

/** @param {string[]} steps  @param {number} current  0-based */
export function stepper(steps, current) {
  return html`<ol class="nj-stepper">${steps.map((s, i) => html`<li class="nj-step"${i === current ? html` aria-current="step"` : ''}>${s}</li>`)}</ol>`;
}

/** @param {{ title?: string, rows: [string, string][], footer?: unknown }} o */
export function summary({ title = 'Summary', rows, footer = '' }) {
  return html`<aside class="nj-summary" aria-label="${title}">
    <h2 class="nj-card-title">${title}</h2>
    <dl>${rows.map(([k, v]) => html`<dt>${k}</dt><dd>${v}</dd>`)}</dl>
    ${footer}
  </aside>`;
}

/** @param {{ owner: string, name: string, lang: string, pushed: string, visibility: string, selected?: boolean }} o */
export function repoRow({ owner, name, lang, pushed, visibility, selected = false }) {
  return html`<div class="nj-repo" role="radio" tabindex="0" aria-checked="${selected}">
    <i class="bi bi-github" aria-hidden="true"></i>
    <div class="flex-grow-1"><div class="nj-repo-name">${owner} / ${name}</div><div class="nj-repo-meta">${lang} · pushed ${pushed}</div></div>
    <span class="nj-pill nj-pill-idle">${visibility}</span>
  </div>`;
}

/** @param {{ id: string, status: string, cpu: [number, number], memory: [number, number], uptime: string }} o  [used, limit] */
export function instanceTile({ id, status, cpu, memory, uptime }) {
  return html`<div class="nj-instance">
    <div class="nj-instance-head"><span class="nj-instance-id">${id}</span>${statusPill(status)}</div>
    ${meter({ label: 'CPU', value: `${cpu[0]} / ${cpu[1]} vCPU`, pct: (cpu[0] / cpu[1]) * 100, metric: 'cpu' })}
    ${meter({ label: 'Memory', value: `${memory[0]} / ${memory[1]} GB`, pct: (memory[0] / memory[1]) * 100, metric: 'memory' })}
    <div class="nj-meta">${uptime}</div>
  </div>`;
}

/**
 * The dark log viewer.
 * @param {{ lines: { t: string, inst: string, level: string, msg: string }[], live?: boolean, footer?: string, empty?: string }} o
 */
export function logViewer({ lines, live = true, footer = '', empty = 'No log lines at this level in the last hour.' }) {
  return html`<section class="nj-logs" aria-label="Logs">
    <div class="nj-logs-bar">
      <span class="nj-pill ${live ? 'nj-pill-live' : 'nj-pill-idle'}">${live ? 'Live' : 'Paused'}</span>
    </div>
    <div class="nj-logs-body" role="log" aria-live="polite">
      ${lines.length
        ? lines.map((l) => html`<div class="nj-log-line"><span class="nj-log-time">${l.t}</span><span class="nj-log-inst">${l.inst}</span><span class="nj-log-level nj-log-${l.level.toLowerCase()}">${l.level}</span><span>${l.msg}</span></div>`)
        : html`<div class="nj-logs-empty">${empty}</div>`}
    </div>
    ${footer ? html`<div class="nj-logs-foot">${footer}</div>` : ''}
  </section>`;
}

/** @param {{ icon?: string, title: string, text?: string, action?: unknown }} o */
export function emptyState({ icon = 'stars', title, text = '', action = '' }) {
  return html`<div class="nj-empty">
    <span class="nj-empty-icon" aria-hidden="true"><i class="bi bi-${icon}"></i></span>
    <h2>${title}</h2>
    ${text ? html`<p>${text}</p>` : ''}
    ${action ? html`<div class="mt-3">${action}</div>` : ''}
  </div>`;
}
