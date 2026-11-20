// New service of a type (product.md §6.3; mock-up "New web service"): four numbered fieldsets (Source code, Build and
// run, Instance type, Environment variables) beside a sticky Summary that prices the choice as it changes, and the
// button that names the action. Web, Private, Worker and Static Site use this screen and drop what they do not need.
// Field errors from the API's 422 appear under their fields (forms.js).
import { html } from '../html.js';
import { api } from '../api.js';
import { showErrors } from '../forms.js';
import { stepper, emptyState } from '../components/index.js';
import { CREATABLE, PLANS, RUNTIMES, MAX_INSTANCES, SLEEP, planOf, estimate, specText, priceText } from '../shared/catalog.js';

const ago = (iso) => {
  if (!iso) return 'a while ago';
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (mins < 60) return `${Math.max(1, mins)} minute${mins === 1 ? '' : 's'} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  const weeks = Math.round(days / 7);
  return weeks === 1 ? 'last week' : `${weeks} weeks ago`;
};

const feedback = (name) => html`<div class="invalid-feedback" id="${name}-error" data-for="${name}"></div>`;

function envRow(i, { key = '', value = '' } = {}) {
  return html`<div class="nj-env-row" data-env-row>
    <label class="visually-hidden" for="env-${i}-key">Key</label>
    <input class="form-control nj-mono" id="env-${i}-key" name="env.${i}.key" value="${key}" placeholder="KEY" autocomplete="off" spellcheck="false" aria-describedby="env.${i}.key-error">
    <label class="visually-hidden" for="env-${i}-value">Value</label>
    <input class="form-control nj-mono" id="env-${i}-value" name="env.${i}.value" type="password" value="${value}" placeholder="value" autocomplete="off" spellcheck="false" aria-describedby="env.${i}.value-error">
    <button type="button" class="btn btn-secondary nj-env-remove" data-env-remove aria-label="Remove variable"><i class="bi bi-trash3" aria-hidden="true"></i></button>
    ${feedback(`env.${i}.key`)}${feedback(`env.${i}.value`)}
  </div>`;
}

function repoList(repos, selected) {
  if (!repos.length) return html`<p class="nj-meta mb-0">No repositories match.</p>`;
  return repos.map((r) => html`<label class="nj-repo">
    <input type="radio" class="visually-hidden" name="repo" value="${r.fullName}" data-branch="${r.defaultBranch}"${r.fullName === selected ? html` checked` : ''}>
    <i class="bi bi-github" aria-hidden="true"></i>
    <span class="flex-grow-1"><span class="nj-repo-name d-block">${r.owner} / ${r.name}</span><span class="nj-repo-meta d-block">${r.language ?? 'Code'} · pushed ${ago(r.pushedAt)}</span></span>
    <span class="nj-pill nj-pill-idle">${r.private ? 'Private' : 'Public'}</span>
  </label>`);
}

function sourceFieldset({ github, repos, workspace }) {
  const owner = workspace.role === 'Owner';
  const connected = github.connected
    ? html`<div class="nj-connected" role="status"><span><i class="bi bi-check-lg" aria-hidden="true"></i> <strong>GitHub connected</strong> · ${github.login} · ${github.organisations.length} organisation${github.organisations.length === 1 ? '' : 's'}</span>
        ${owner ? html`<a href="/w/${workspace.id}/github">Change repo access</a>` : ''}</div>
      <div class="nj-search"><i class="bi bi-search" aria-hidden="true"></i><label class="visually-hidden" for="repo-search">Search repositories</label>
        <input class="form-control" id="repo-search" type="search" placeholder="Search repositories" autocomplete="off"></div>
      <div role="radiogroup" aria-label="Repository" aria-describedby="repo-error" class="nj-repos" data-repos>${repoList(repos, repos[0]?.fullName)}</div>`
    : html`<div class="nj-notice" role="status"><strong>Connect GitHub to choose a repository.</strong>
        ${owner ? html`<a class="btn btn-primary btn-sm" href="/w/${workspace.id}/github/connect" data-reload>Connect GitHub</a>` : html`<span>Ask the workspace owner to connect GitHub.</span>`}</div>`;
  return html`<fieldset class="nj-fieldset">
    <legend><span class="nj-step-no" aria-hidden="true">1</span>Source code</legend>
    <div role="tablist" aria-label="Source" class="nj-tabs">
      <button type="button" role="tab" class="nj-tab" aria-selected="true" aria-controls="src-github" id="tab-github" data-tab="github">GitHub</button>
      <button type="button" role="tab" class="nj-tab" aria-selected="false" aria-controls="src-git" id="tab-git" data-tab="git" tabindex="-1">Public Git URL</button>
      <button type="button" role="tab" class="nj-tab" aria-selected="false" aria-controls="src-image" id="tab-image" data-tab="image" tabindex="-1">Docker image</button>
    </div>
    <div role="tabpanel" id="src-github" aria-labelledby="tab-github" class="nj-stack-gap">${connected}${feedback('repo')}</div>
    <div role="tabpanel" id="src-git" aria-labelledby="tab-git" hidden class="nj-stack-gap">
      <div><label class="form-label" for="f-git-url">Public Git repository</label>
        <input class="form-control" id="f-git-url" name="repoUrl" type="url" inputmode="url" placeholder="https://github.com/render-examples/express-hello-world" autocomplete="off" spellcheck="false" aria-describedby="git-url-hint repoUrl-error">
        <div class="form-text" id="git-url-hint">Any public repository you can clone over https://. No GitHub connection needed.</div>${feedback('repoUrl')}</div>
      <div><label class="form-label" for="f-git-branch">Branch</label>
        <input class="form-control" id="f-git-branch" name="gitBranch" value="main" autocomplete="off" spellcheck="false" aria-describedby="branch-error"></div>
    </div>
    <div role="tabpanel" id="src-image" aria-labelledby="tab-image" hidden><p class="nj-meta mb-0">Deploying a prebuilt Docker image is coming soon. Use GitHub for now.</p></div>
  </fieldset>`;
}

function buildFieldset({ catalog, type, firstRepo }) {
  const name = (firstRepo?.name ?? '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^[^a-z]+/, '').slice(0, 63);
  return html`<fieldset class="nj-fieldset">
    <legend><span class="nj-step-no" aria-hidden="true">2</span>Build and run</legend>
    <div class="nj-grid-2">
      <div><label class="form-label" for="f-name">Service name</label>
        <input class="form-control" id="f-name" name="name" value="${name}" required maxlength="63" autocomplete="off" spellcheck="false" aria-describedby="name-hint name-error">
        <div class="form-text" id="name-hint">${type.publicUrl ? html`Your URL will be <span data-url-full>${name || 'name'}.${catalog.appDomain}</span>` : type.key === 'private' ? 'Reachable inside this workspace by this name.' : 'A worker has no URL.'}</div>${feedback('name')}</div>
      <div><label class="form-label" for="f-branch">Branch</label>
        <select class="form-select" id="f-branch" name="branch" aria-describedby="branch-error"><option>main</option></select>${feedback('branch')}</div>
      <div><label class="form-label" for="f-region">Region</label>
        <select class="form-select" id="f-region" name="region" aria-describedby="region-hint region-error">${catalog.regions.map((r) => html`<option value="${r.id}"${r.available ? '' : html` disabled`}>${r.name} (${r.id})${r.available ? '' : ' · coming soon'}</option>`)}</select>
        <div class="form-text" id="region-hint">Local network runs on your own servers. Frankfurt and Singapore open later.</div>${feedback('region')}</div>
      <div><label class="form-label" for="f-runtime">Runtime</label>
        <select class="form-select" id="f-runtime" name="runtime" aria-describedby="runtime-error">${RUNTIMES.map((r) => html`<option value="${r.key}">${r.name}</option>`)}</select>${feedback('runtime')}</div>
    </div>
    <div><label class="form-label" for="f-root">Root directory <span class="nj-meta">· optional</span></label>
      <input class="form-control nj-mono" id="f-root" name="rootDir" placeholder="apps/api" autocomplete="off" spellcheck="false" aria-describedby="root-hint rootDir-error">
      <div class="form-text" id="root-hint">Leave empty to build from the top of the repo.</div>${feedback('rootDir')}</div>
    <div class="nj-grid-2">
      <div><label class="form-label" for="f-build">Build command</label>
        <input class="form-control nj-mono" id="f-build" name="buildCommand" value="npm ci && npm run build" autocomplete="off" spellcheck="false" aria-describedby="buildCommand-error">${feedback('buildCommand')}</div>
      ${type.key === 'static' ? '' : html`<div><label class="form-label" for="f-start">Start command</label>
        <input class="form-control nj-mono" id="f-start" name="startCommand" value="npm start" autocomplete="off" spellcheck="false" aria-describedby="startCommand-error">${feedback('startCommand')}</div>`}
    </div>
  </fieldset>`;
}

function instanceFieldset(type) {
  if (!type.instances) return '';
  return html`<fieldset class="nj-fieldset">
    <legend><span class="nj-step-no" aria-hidden="true">3</span>Instance type</legend>
    <p class="mb-0">This is the CPU and memory reserved for each instance. You can change it later without redeploying.</p>
    <div role="radiogroup" aria-label="Instance type" aria-describedby="plan-error" class="nj-plans">${PLANS.map((p) => html`<label class="nj-plan">
      <input type="radio" class="visually-hidden" name="plan" value="${p.key}"${p.key === 'standard' ? html` checked` : ''}>
      <span class="nj-plan-name">${p.name}</span>
      <span class="nj-plan-price nj-num">${priceText(p.priceUsd)}</span>
      <span class="nj-plan-spec nj-num">${specText(p)}</span>
    </label>`)}</div>${feedback('plan')}
    <div class="nj-instances">
      <label class="form-label mb-0" for="f-instances">Instances</label>
      <input class="form-control nj-num" id="f-instances" name="instances" type="number" value="2" min="1" max="${MAX_INSTANCES}" aria-describedby="instances-hint instances-error">
      <span class="form-text mt-0" id="instances-hint">Traffic is balanced across instances. Add more for zero-downtime deploys. Up to ${MAX_INSTANCES}, at the same price.</span>
    </div>${feedback('instances')}
  </fieldset>`;
}

function envFieldset({ groups, type }) {
  return html`<fieldset class="nj-fieldset">
    <legend><span class="nj-step-no" aria-hidden="true">${type.instances ? 4 : 3}</span>Environment variables</legend>
    <div class="nj-env" data-env>${envRow(0, { key: 'NODE_ENV', value: 'production' })}</div>${feedback('env')}
    <div class="d-flex flex-wrap gap-2">
      <button type="button" class="btn btn-secondary btn-sm" data-env-add><i class="bi bi-plus-lg" aria-hidden="true"></i> Add variable</button>
      <button type="button" class="btn btn-link btn-sm" data-dotenv-open aria-expanded="false" aria-controls="dotenv">Add from .env</button>
      <button type="button" class="btn btn-link btn-sm" data-groups-open aria-expanded="false" aria-controls="link-groups">Link environment group</button>
    </div>
    <div id="dotenv" class="nj-stack-gap" hidden>
      <label class="form-label mb-0" for="f-dotenv">Paste a .env file</label>
      <textarea class="form-control nj-mono" id="f-dotenv" rows="5" spellcheck="false" placeholder="DATABASE_URL=postgres://…"></textarea>
      <div><button type="button" class="btn btn-secondary btn-sm" data-dotenv-add>Add these variables</button> <span class="nj-meta" role="status" data-dotenv-status></span></div>
    </div>
    <div id="link-groups" class="nj-stack-gap" hidden>
      ${groups.length ? html`<fieldset><legend class="form-label">Environment groups</legend>${groups.map((g) => html`<div class="form-check">
        <input class="form-check-input" type="checkbox" id="grp-${g.id}" name="envGroups" value="${g.id}"><label class="form-check-label" for="grp-${g.id}">${g.name} <span class="nj-meta">· ${g.vars.length} variable${g.vars.length === 1 ? '' : 's'}</span></label></div>`)}</fieldset>${feedback('envGroups')}`
        : html`<p class="nj-meta mb-0">No environment groups yet. Make one on the Environment groups page.</p>`}
    </div>
  </fieldset>`;
}

function summaryAside(type) {
  return html`<aside class="nj-summary" aria-label="Summary">
    <h2 class="nj-card-title">Summary</h2>
    <dl>
      <dt>Type</dt><dd>${type.label}</dd>
      <dt>Repo</dt><dd data-sum="repo">—</dd>
      <dt>Branch</dt><dd data-sum="branch">main</dd>
      ${type.instances ? html`<dt>Instance</dt><dd data-sum="plan">Standard</dd><dt>Compute</dt><dd data-sum="compute" class="nj-num">1 CPU · 2 GB × 2</dd>` : ''}
    </dl>
    <hr>
    <div class="nj-summary-total"><span>Estimated</span><strong class="nj-num" data-sum="price">$— / mo</strong></div>
    <p class="nj-meta mb-1">A flat price for the service, for 1 to ${MAX_INSTANCES} instances.</p>
    ${type.sleeps ? html`<p class="nj-meta">Sleeps after ${SLEEP.afterMinutes} minutes without requests, and wakes on the next one. ${SLEEP.wakeText}</p>` : ''}
    <div class="nj-switch-row">
      <span><strong class="d-block">Auto-deploy</strong><span class="nj-meta" data-sum="auto">Deploy on every push to main</span></span>
      <input class="form-check-input nj-switch" type="checkbox" role="switch" name="autoDeploy" id="f-auto" checked aria-label="Auto-deploy on push">
    </div>
    <div class="alert alert-danger mt-3 mb-0" role="alert" tabindex="-1" data-form-alert hidden></div>
    <button type="submit" class="btn btn-primary w-100 nj-deploy-btn">${type.action}</button>
    <p class="nj-meta mt-2 mb-0">Your first build starts straight away. You can watch it in the logs.</p>
  </aside>`;
}

/** The page for a creatable type (web, private, worker, static). */
export async function createServicePage({ workspace, typeInfo, url }) {
  const ws = encodeURIComponent(workspace.id);
  const type = { key: typeInfo.key, ...CREATABLE[typeInfo.key] };
  const [catalog, github, groupsRes] = await Promise.all([
    api(`/api/v1/workspaces/${ws}/catalog`),
    api(`/api/v1/workspaces/${ws}/github`),
    api(`/api/v1/workspaces/${ws}/env-groups`),
  ]);
  const listed = github.connected ? (await api(`/api/v1/workspaces/${ws}/github/repos`)).repos : [];
  // ?repo=owner/name (the GitHub page's Deploy button) puts that repository first and picks it.
  const wanted = url?.searchParams?.get('repo');
  const repos = wanted ? [...listed.filter((r) => r.fullName === wanted), ...listed.filter((r) => r.fullName !== wanted)] : listed;
  const groups = groupsRes.groups;

  return {
    title: `New ${typeInfo.name} · ${workspace.name}`,
    content: html`<div class="nj-page-head"><div>
        <p class="nj-breadcrumb"><a href="/w/${workspace.id}">Production</a> / <a href="/w/${workspace.id}/new">New service</a> / ${typeInfo.name}</p>
        <h1 class="nj-title">New ${typeInfo.name}</h1>
        <p class="nj-lead">Connect a repo, tell us how to build and run it, and choose how much compute it gets.</p></div></div>
      ${stepper(['Choose service', 'Connect repo', 'Configure', 'Deploy'], 2)}
      <form class="nj-with-summary" novalidate data-form="create">
        <div class="nj-stack-gap-lg">
          ${sourceFieldset({ github, repos, workspace })}
          ${buildFieldset({ catalog, type, firstRepo: repos[0] })}
          ${instanceFieldset(type)}
          ${envFieldset({ groups, type })}
        </div>
        ${summaryAside(type)}
      </form>`,

    async mount(root) {
      const form = root.querySelector('[data-form="create"]');
      const $ = (sel) => form.querySelector(sel);
      const branchSelect = $('#f-branch');
      let rowCount = form.querySelectorAll('[data-env-row]').length;

      // Source tabs (arrow keys move between them). `source` is the chosen one: github or git.
      const tabs = [...form.querySelectorAll('[role="tab"]')];
      let source = 'github';
      const select = (tab, { focus = true } = {}) => {
        source = tab.dataset.tab;
        for (const t of tabs) {
          const on = t === tab;
          t.setAttribute('aria-selected', String(on));
          t.tabIndex = on ? 0 : -1;
          form.querySelector(`#${t.getAttribute('aria-controls')}`).hidden = !on;
        }
        if (focus) tab.focus();
        update();
      };
      for (const t of tabs) {
        t.addEventListener('click', () => select(t));
        t.addEventListener('keydown', (e) => {
          const i = tabs.indexOf(t);
          if (e.key === 'ArrowRight') select(tabs[(i + 1) % tabs.length]);
          if (e.key === 'ArrowLeft') select(tabs[(i + tabs.length - 1) % tabs.length]);
        });
      }

      async function loadBranches() {
        const picked = form.querySelector('input[name="repo"]:checked');
        if (!picked) return;
        const [owner, name] = picked.value.split('/');
        try {
          const { branches } = await api(`/api/v1/workspaces/${ws}/github/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/branches`);
          const preferred = picked.dataset.branch;
          branchSelect.innerHTML = String(html`${branches.map((b) => html`<option${b === preferred ? html` selected` : ''}>${b}</option>`)}`);
        } catch (err) {
          branchSelect.innerHTML = String(html`<option>${picked.dataset.branch}</option>`);
        }
        update();
      }

      function update() {
        const gitUrl = $('#f-git-url').value.trim();
        const repo = source === 'git' ? gitUrl.replace(/^https:\/\//, '') : form.querySelector('input[name="repo"]:checked')?.value;
        const plan = planOf(form.querySelector('input[name="plan"]:checked')?.value ?? 'standard');
        const instances = type.instances ? Math.max(1, Number($('#f-instances')?.value) || 1) : 1;
        const branch = (source === 'git' ? $('#f-git-branch').value.trim() : branchSelect.value) || 'main';
        const set = (key, value) => {
          const el = form.querySelector(`[data-sum="${key}"]`);
          if (el) el.textContent = value;
        };
        set('repo', repo ? (source === 'git' ? repo : repo.replace('/', ' / ')) : '—');
        set('branch', branch);
        if (plan) {
          set('plan', plan.name);
          set('compute', `${specText(plan)} × ${instances}`);
        }
        const est = estimate(plan?.key);
        set('price', est.text);
        set('auto', $('#f-auto').checked ? `Deploy on every push to ${branch}` : 'Deploy only when you ask');
        // A Local network service answers at <this site>/<workspace>/<name>/; elsewhere at <name>.<app domain>.
        const url = form.querySelector('[data-url-full]');
        const regionId = $('#f-region').value;
        const local = catalog.regions.find((r) => r.id === regionId)?.local;
        if (url) url.textContent = local ? `${window.location.origin}/${workspace.id}/${$('#f-name').value || 'name'}/` : `${$('#f-name').value || 'name'}.${catalog.appDomain}`;
      }

      // Pick a repository: name and branch follow it until the person changes the name themselves.
      let nameTouched = false;
      $('#f-name').addEventListener('input', () => { nameTouched = true; });
      form.addEventListener('change', (e) => {
        if (e.target.name === 'repo') {
          if (!nameTouched) $('#f-name').value = e.target.value.split('/')[1].toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^[^a-z]+/, '').slice(0, 63);
          loadBranches();
        }
        update();
      });
      form.addEventListener('input', update);
      // A public URL names the service after its last part, until the person names it themselves.
      $('#f-git-url').addEventListener('input', () => {
        if (nameTouched) return;
        const last = $('#f-git-url').value.trim().replace(/\.git$/, '').replace(/\/+$/, '').split('/').pop() ?? '';
        $('#f-name').value = last.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^[^a-z]+/, '').slice(0, 63);
        update();
      });

      const search = $('#repo-search');
      search?.addEventListener('input', () => {
        const q = search.value.trim().toLowerCase();
        const checked = form.querySelector('input[name="repo"]:checked')?.value;
        $('[data-repos]').innerHTML = String(repoList(repos.filter((r) => !q || r.fullName.toLowerCase().includes(q)), checked));
      });

      // Environment variables.
      const envBox = $('[data-env]');
      const addRow = (v) => {
        envBox.insertAdjacentHTML('beforeend', String(envRow(rowCount, v)));
        rowCount += 1;
      };
      $('[data-env-add]').addEventListener('click', () => {
        addRow();
        envBox.lastElementChild.querySelector('input').focus();
      });
      envBox.addEventListener('click', (e) => {
        const remove = e.target.closest('[data-env-remove]');
        if (remove) remove.closest('[data-env-row]').remove();
      });
      const toggle = (button, panelId) => button.addEventListener('click', () => {
        const panel = form.querySelector(`#${panelId}`);
        panel.hidden = !panel.hidden;
        button.setAttribute('aria-expanded', String(!panel.hidden));
      });
      toggle($('[data-dotenv-open]'), 'dotenv');
      toggle($('[data-groups-open]'), 'link-groups');
      $('[data-dotenv-add]').addEventListener('click', async () => {
        const status = $('[data-dotenv-status]');
        try {
          const { env, skipped } = await api(`/api/v1/workspaces/${ws}/env/parse`, { method: 'POST', body: { text: $('#f-dotenv').value } });
          const existing = new Map([...envBox.querySelectorAll('[data-env-row]')].map((row) => [row.querySelector('input').value.trim(), row]));
          for (const v of env) {
            const row = existing.get(v.key);
            if (row) row.querySelectorAll('input')[1].value = v.value;
            else addRow(v);
          }
          $('#f-dotenv').value = '';
          status.textContent = `Added ${env.length} variable${env.length === 1 ? '' : 's'}${skipped ? `; skipped ${skipped} line${skipped === 1 ? '' : 's'} with an unusable key` : ''}.`;
        } catch (err) {
          status.textContent = err.message;
        }
      });

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        for (const el of form.querySelectorAll('[aria-invalid="true"]')) {
          el.removeAttribute('aria-invalid');
          el.classList.remove('is-invalid');
        }
        for (const el of form.querySelectorAll('.invalid-feedback[data-for]')) el.textContent = '';
        const alert = form.querySelector('[data-form-alert]');
        alert.hidden = true;
        const rows = [...envBox.querySelectorAll('[data-env-row]')];
        // Rename the row inputs in order, so an error's path (env.N.key) finds its field.
        rows.forEach((row, i) => {
          const [k, v] = row.querySelectorAll('input');
          k.name = `env.${i}.key`;
          v.name = `env.${i}.value`;
          const [fk, fv] = row.querySelectorAll('.invalid-feedback');
          fk.dataset.for = `env.${i}.key`;
          fv.dataset.for = `env.${i}.value`;
        });
        const body = {
          type: type.key,
          name: $('#f-name').value.trim(),
          ...(source === 'git'
            ? { repoUrl: $('#f-git-url').value.trim(), branch: $('#f-git-branch').value.trim() }
            : { repo: form.querySelector('input[name="repo"]:checked')?.value ?? '', branch: branchSelect.value }),
          region: $('#f-region').value,
          runtime: $('#f-runtime').value,
          rootDir: $('#f-root').value,
          buildCommand: $('#f-build').value,
          ...(type.key === 'static' ? {} : { startCommand: $('#f-start').value }),
          plan: form.querySelector('input[name="plan"]:checked')?.value ?? 'standard',
          instances: type.instances ? Number($('#f-instances').value) : 1,
          env: rows.map((row) => {
            const [k, v] = row.querySelectorAll('input');
            return { key: k.value.trim(), value: v.value };
          }).filter((v) => v.key || v.value),
          envGroups: [...form.querySelectorAll('input[name="envGroups"]:checked')].map((c) => c.value),
          autoDeploy: $('#f-auto').checked,
        };
        const button = form.querySelector('[type="submit"]');
        const label = button.textContent;
        button.disabled = true;
        button.textContent = 'Starting the first build…';
        try {
          const result = await api(`/api/v1/workspaces/${ws}/services`, { method: 'POST', body });
          window.location.assign(result.redirect);
        } catch (err) {
          showErrors(form, err);
          button.disabled = false;
          button.textContent = label;
        }
      });

      // Without a GitHub connection, a public Git URL is the way in.
      if (!github.connected) select(tabs.find((t) => t.dataset.tab === 'git'), { focus: false });
      await loadBranches();
      update();
    },
  };
}

/** A type that cannot be created yet: what it is and when it comes. */
export function comingTypePage({ workspace, typeInfo }) {
  const when = { cron: 'with scheduled runs', workflow: 'with workflows', postgres: 'with managed Postgres', keyvalue: 'with managed Key Value', sandbox: 'once sandbox isolation is decided' }[typeInfo.key];
  return {
    title: `New ${typeInfo.name} · ${workspace.name}`,
    content: html`<div class="nj-page-head"><div>
        <p class="nj-breadcrumb"><a href="/w/${workspace.id}">Production</a> / <a href="/w/${workspace.id}/new">New service</a> / ${typeInfo.name}</p>
        <h1 class="nj-title">New ${typeInfo.name}</h1><p class="nj-lead">${typeInfo.text}</p></div></div>
      ${emptyState({ icon: 'cone-striped', title: `${typeInfo.name} is coming`, text: `You can create these ${when}. Web services, private services, workers and static sites work today.`, action: html`<a class="btn btn-primary" href="/w/${workspace.id}/new/web">New web service</a>` })}`,
  };
}
