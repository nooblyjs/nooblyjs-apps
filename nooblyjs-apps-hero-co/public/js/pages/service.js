// A service (roadmap 2.7; the full page with resources, instances and live logs is Phase 4): the header with its
// status, URL and plan; the latest deploy's steps as a progress bar; its build and rollout log in the dark viewer; the
// recent deploys; and the environment variables (keys only, with an audited reveal). Deploy changes arrive over the
// live channel and redraw the parts they touch.
import { html } from '../html.js';
import { api } from '../api.js';
import { on } from '../sse.js';
import { applySizes } from '../charts.js';
import { statusPill, emptyState } from '../components/index.js';
import { SLEEP } from '../shared/catalog.js';

const WORD = { queued: 'Queued', building: 'Building', deploying: 'Deploying', live: 'Live', failed: 'Failed', cancelled: 'Cancelled', superseded: 'Succeeded', suspended: 'Suspended', sleeping: 'Sleeping', idle: 'Idle' };
export const statusWord = (s) => WORD[s] ?? (s ? s[0].toUpperCase() + s.slice(1) : 'Idle');
const STEPS = ['Clone', 'Build', 'Roll out'];
const TYPE_NAME = { postgres: 'Postgres', keyvalue: 'Key Value', cron: 'Cron Job' };
const time = (iso) => (iso ? new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '');
const when = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
const short = (sha) => (sha ? sha.slice(0, 7) : '—');

function progress(d) {
  if (!d) return '';
  const of = d.of ?? STEPS.length;
  const step = d.status === 'live' || d.status === 'superseded' ? of : Math.min(d.step ?? 0, of);
  const pct = Math.round((step / of) * 100);
  const label = d.status === 'failed' ? `Failed at step ${Math.max(1, step)} of ${of}` : d.status === 'live' ? `Live · ${of} of ${of} steps` : `Step ${step} of ${of}`;
  return html`<div class="nj-meter-row">
    <div class="nj-meter-head"><span>${label}</span><span class="nj-num">${pct}%</span></div>
    <div class="nj-meter nj-meter-${d.status === 'failed' ? 'failed' : 'requests'}" role="progressbar" aria-label="Deploy progress" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-valuetext="${label}">
      <div class="nj-meter-fill" data-pct="${pct}"></div>
    </div>
    <ol class="nj-deploy-steps">${STEPS.map((s, i) => html`<li class="${i < step ? 'is-done' : i === step && d.status !== 'failed' ? 'is-now' : ''}">${s}</li>`)}</ol>
  </div>`;
}

function deployCard(d) {
  if (!d) return emptyState({ icon: 'rocket-takeoff', title: 'No deploys yet' });
  return html`<div class="d-flex flex-wrap justify-content-between gap-2 mb-3">
      <div><strong class="nj-mono">${short(d.commit)}</strong> ${d.message ?? ''}
        <div class="nj-meta">${d.trigger === 'manual' ? 'Started by' : d.trigger === 'config' ? 'Settings changed by' : 'Triggered by'} ${d.by?.name ?? 'a push'} · ${when(d.startedAt)}</div></div>
      ${statusPill(statusWord(d.status))}
    </div>
    ${progress(d)}
    ${d.status === 'failed' && d.reason ? html`<div class="alert alert-danger mt-3 mb-0" role="alert">${d.reason}</div>` : ''}`;
}

function logView(lines, live) {
  return html`<section class="nj-logs" aria-label="Build log">
    <div class="nj-logs-bar"><span class="nj-pill ${live ? 'nj-pill-live' : 'nj-pill-idle'}">${live ? 'Live' : 'Finished'}</span><span class="nj-meta">Build and rollout</span></div>
    <div class="nj-logs-body" role="log" aria-live="polite">${lines.length
      ? lines.map((l) => html`<div class="nj-log-line nj-log-line-build"><span class="nj-log-time">${time(l.at)}</span><span class="nj-log-level nj-log-${(l.level ?? 'info').toLowerCase()}">${(l.level ?? 'info').toUpperCase()}</span><span>${l.text}</span></div>`)
      : html`<div class="nj-logs-empty">Waiting for the build to start…</div>`}</div>
  </section>`;
}

const LOG_KEEP = 2000;

/** One console line: time, instance, OUT or ERR (a word as well as a colour), the text. */
const runtimeLine = (l) => html`<div class="nj-log-line"><span class="nj-log-time">${time(l.at)}</span><span class="nj-log-inst">${l.instance ?? ''}</span><span class="nj-log-level nj-log-${l.out === 'stderr' ? 'error' : 'info'}">${l.out === 'stderr' ? 'ERR' : 'OUT'}</span><span>${l.line}</span></div>`;

/** The live Logs terminal of a Local network service (infra 8.9 R11): live tail, search, errors only, pause. */
function runtimeLogs() {
  return html`<section class="nj-logs mb-4" aria-labelledby="logs-title">
    <div class="nj-logs-bar">
      <span class="nj-pill nj-pill-live" data-logs-state>Live</span><h2 class="nj-logs-title" id="logs-title">Logs</h2>
      <label class="visually-hidden" for="logs-search">Search the logs</label>
      <input class="form-control form-control-sm nj-logs-input" id="logs-search" type="search" placeholder="Search" autocomplete="off">
      <label class="visually-hidden" for="logs-stream">Which output</label>
      <select class="form-select form-select-sm nj-logs-input" id="logs-stream"><option value="">All output</option><option value="stderr">Errors only (stderr)</option></select>
      <button type="button" class="btn btn-sm btn-secondary" data-logs-pause aria-pressed="false">Pause</button>
    </div>
    <div class="nj-logs-body" role="log" aria-live="polite" data-logs-body><div class="nj-logs-empty">Waiting for output…</div></div>
    <div class="nj-logs-foot" data-logs-foot>The console output of the running instances, as it happens. The last ${LOG_KEEP.toLocaleString()} lines are kept.</div>
  </section>`;
}

function deploysTable(list) {
  return html`<div class="table-responsive"><table class="table">
    <caption class="visually-hidden">Recent deploys</caption>
    <thead><tr><th scope="col">Commit</th><th scope="col">Trigger</th><th scope="col">Status</th><th scope="col">Started</th></tr></thead>
    <tbody>${list.map((d) => html`<tr><td><span class="nj-mono">${short(d.commit)}</span> <span class="nj-meta">${d.message ?? ''}</span></td><td>${d.trigger}</td><td>${statusPill(statusWord(d.status))}</td><td class="nj-num">${when(d.startedAt)}</td></tr>`)}</tbody>
  </table></div>`;
}

export async function servicePage({ workspace, params }) {
  const ws = encodeURIComponent(workspace.id);
  const base = `/api/v1/workspaces/${ws}/services/${encodeURIComponent(params.service)}`;
  let svc;
  try {
    svc = await api(base);
  } catch (err) {
    if (err.status !== 404) throw err;
    return {
      title: `${params.service} · ${workspace.name}`,
      content: emptyState({ icon: 'signpost-split', title: `There is no service called ${params.service}`, action: html`<a class="btn btn-secondary" href="/w/${workspace.id}">Back to Production</a>` }),
    };
  }
  const latest = svc.deploys[0] ?? null;
  const detail = latest ? await api(`${base}/deploys/${encodeURIComponent(latest.id)}`) : null;
  const running = (d) => d && ['queued', 'building', 'deploying'].includes(d.status);

  return {
    title: `${svc.name} · ${workspace.name}`,
    content: html`<div class="nj-page-head"><div>
        <p class="nj-breadcrumb"><a href="/w/${workspace.id}">Production</a> / ${svc.name}</p>
        <div class="nj-title-row"><h1 class="nj-title">${svc.name}</h1><span data-status role="status" aria-label="Status">${statusPill(statusWord(svc.status))}</span></div>
        <p class="nj-lead">${TYPE_NAME[svc.type] ?? svc.typeLabel} · ${svc.planName}${svc.spec ? ` (${svc.spec})` : ''}${['static', 'postgres', 'keyvalue'].includes(svc.type) ? '' : ` × ${svc.instances}`} · ${svc.regionName} (${svc.region})${svc.runtimeName ? ` · ${svc.runtimeName}` : ''}</p>
        <p class="nj-meta mb-1">${svc.estimate.text}${svc.sleepsWhenIdle ? ` · sleeps after ${SLEEP.afterMinutes} minutes without requests` : ''}</p>
        ${svc.source ? html`<p class="nj-meta mb-0"><i class="bi bi-github" aria-hidden="true"></i> ${svc.source.repo} · ${svc.source.branch}${svc.source.rootDir ? ` · ${svc.source.rootDir}` : ''} · ${svc.autoDeploy ? 'Auto-deploy on push' : 'Manual deploys'}</p>` : html`<p class="nj-meta mb-0">Managed data store. Its own page (connection details, backups) arrives with managed ${svc.typeLabel === 'postgres' ? 'Postgres' : 'Key Value'}.</p>`}
      </div>
      ${svc.path ? html`<a class="btn btn-secondary" href="${svc.path}" data-reload rel="noopener" target="_blank">${window.location.origin}${svc.path} <i class="bi bi-box-arrow-up-right" aria-hidden="true"></i></a>`
    : svc.url ? html`<a class="btn btn-secondary" href="${svc.url}" data-reload rel="noopener" target="_blank">${svc.url.replace('https://', '')} <i class="bi bi-box-arrow-up-right" aria-hidden="true"></i></a>` : svc.internalHost ? html`<span class="nj-meta">Private: <code>${svc.internalHost}</code></span>` : ''}
      </div>

      <section class="nj-card mb-4" aria-labelledby="deploy-title">
        <h2 class="nj-card-title" id="deploy-title">Latest deploy</h2>
        <div data-deploy>${deployCard(latest)}</div>
      </section>
      <div class="mb-4" data-log>${logView(detail?.log ?? [], running(latest))}</div>
      ${svc.local ? runtimeLogs() : ''}

      <section class="nj-card mb-4" aria-labelledby="deploys-title">
        <h2 class="nj-card-title" id="deploys-title">Deploys</h2>
        <div data-deploys>${deploysTable(svc.deploys)}</div>
      </section>

      <section class="nj-card" aria-labelledby="env-title">
        <h2 class="nj-card-title" id="env-title">Environment variables</h2>
        ${svc.env.length ? html`<ul class="list-unstyled nj-env-keys mb-0">${svc.env.map((e) => html`<li><code>${e.key}</code> <span class="nj-meta" data-value-for="${e.key}">••••••••</span>
          <button type="button" class="btn btn-link btn-sm" data-reveal="${e.key}">Reveal</button></li>`)}</ul>` : html`<p class="nj-meta mb-0">No variables of its own.</p>`}
        ${svc.envGroups.length ? html`<p class="nj-meta mt-3 mb-0">Linked groups: ${svc.envGroups.map((g) => g.name).join(', ')}</p>` : ''}
        <p class="nj-meta mt-3 mb-0">Values are encrypted and never shown in lists. Revealing one asks you to type the service name, and is recorded.</p>
      </section>`,

    mount(root) {
      let current = latest;
      const box = root.querySelector('[data-deploy]');
      const logBox = root.querySelector('[data-log]');

      async function refreshLog(d) {
        try {
          const full = await api(`${base}/deploys/${encodeURIComponent(d.id)}`);
          logBox.innerHTML = String(logView(full.log, running(d)));
          const body = logBox.querySelector('.nj-logs-body');
          body.scrollTop = body.scrollHeight;
        } catch { /* the next event tries again */ }
      }

      // The build log grows line by line while a deploy runs: read it again every 2 seconds until it ends.
      const poll = setInterval(() => { if (running(current)) refreshLog(current); }, 2000);

      // Logs: the kept lines, then live 'log' events for this service.
      let stopLogs = () => {};
      if (svc.local) {
        const body = root.querySelector('[data-logs-body]');
        const search = root.querySelector('#logs-search');
        const stream = root.querySelector('#logs-stream');
        const pause = root.querySelector('[data-logs-pause]');
        const state = root.querySelector('[data-logs-state]');
        let lines = [];
        let paused = false;
        let lastSeq = 0;
        const draw = () => {
          const q = search.value.trim().toLowerCase();
          const shown = lines.filter((l) => (!stream.value || l.out === stream.value) && (!q || l.line.toLowerCase().includes(q)));
          const atEnd = body.scrollHeight - body.scrollTop - body.clientHeight < 40;
          body.innerHTML = shown.length ? String(html`${shown.slice(-500).map(runtimeLine)}`) : String(html`<div class="nj-logs-empty">${lines.length ? 'No lines match.' : 'Waiting for output…'}</div>`);
          if (atEnd || !paused) body.scrollTop = body.scrollHeight;
        };
        const add = (more) => {
          const fresh = more.filter((l) => !l.seq || l.seq > lastSeq);
          if (!fresh.length) return;
          lastSeq = Math.max(lastSeq, ...fresh.map((l) => l.seq ?? 0));
          // stdout and stderr are followed separately: keep the lines in time order.
          lines = [...lines, ...fresh].sort((a, b) => String(a.at).localeCompare(String(b.at))).slice(-LOG_KEEP);
          if (!paused) draw();
        };
        api(`${base}/logs`).then((r) => add(r.lines)).catch(() => {});
        stopLogs = on('log', (e) => {
          if (e.service !== svc.name) return;
          add(e.lines.map((l) => ({ ...l, instance: l.instance ? l.instance.slice(-6) : null })));
        });
        search.addEventListener('input', draw);
        stream.addEventListener('change', draw);
        pause.addEventListener('click', () => {
          paused = !paused;
          pause.setAttribute('aria-pressed', String(paused));
          pause.textContent = paused ? 'Resume' : 'Pause';
          state.textContent = paused ? 'Paused' : 'Live';
          state.className = `nj-pill ${paused ? 'nj-pill-idle' : 'nj-pill-live'}`;
          if (!paused) draw();
        });
      }

      const stopDeploys = on('deploy', async (e) => {
        if (e.service !== svc.name) return;
        if (e.status) root.querySelector('[data-status]').innerHTML = String(statusPill(statusWord(e.status)));
        if (!e.deploy) return;
        if (current && e.deploy.id !== current.id && Date.parse(e.deploy.startedAt ?? 0) < Date.parse(current.startedAt ?? 0)) return;
        current = e.deploy;
        box.innerHTML = String(deployCard(current));
        applySizes(box);
        if (current.status === 'live') root.querySelector('[data-status]').innerHTML = String(statusPill('Live'));
        await refreshLog(current);
        const { deploys } = await api(`${base}/deploys`);
        root.querySelector('[data-deploys]').innerHTML = String(deploysTable(deploys.slice(0, 10)));
      });

      root.addEventListener('click', async (event) => {
        const button = event.target.closest('[data-reveal]');
        if (!button) return;
        const key = button.dataset.reveal;
        const confirm = window.prompt(`Type ${svc.name} to reveal ${key}. This is recorded.`);
        if (confirm === null) return;
        try {
          const { value } = await api(`${base}/env/${encodeURIComponent(key)}/reveal`, { method: 'POST', body: { confirm } });
          const out = root.querySelector(`[data-value-for="${CSS.escape(key)}"]`);
          out.textContent = value;
          out.classList.add('nj-mono');
          button.remove();
        } catch (err) {
          window.alert(err.details?.[0]?.message ?? err.message);
        }
      });
      return () => {
        clearInterval(poll);
        stopDeploys();
        stopLogs();
      };
    },
  };
}
