// GitHub (roadmap 2.4): the workspace's connection: who it is, which organisations it can see, the repositories, and
// (Owner only) connect, reconnect and disconnect. product.md §11 [GITHUB]: an OAuth app for now.
import { html } from '../html.js';
import { api } from '../api.js';
import { emptyState } from '../components/index.js';

const ERRORS = {
  'owner-only': 'Only the workspace owner can connect GitHub.',
  'not-configured': 'GitHub sign-in is not set up on this installation.',
  github: 'GitHub did not finish connecting. Try again.',
};

export async function githubPage({ workspace, url }) {
  const base = `/api/v1/workspaces/${encodeURIComponent(workspace.id)}/github`;
  const status = await api(base);
  const repos = status.connected ? (await api(`${base}/repos`).catch(() => ({ repos: [] }))).repos : [];
  const error = ERRORS[url?.searchParams?.get('error')];
  const justConnected = url?.searchParams?.get('connected') === '1';

  return {
    title: `GitHub · ${workspace.name}`,
    content: html`<div class="nj-page-head"><div><p class="nj-breadcrumb">${workspace.name}</p><h1 class="nj-title">GitHub</h1>
        <p class="nj-lead">Your GitHub connection and which repositories NooblyJS Cloud can see.</p></div>
        ${status.connected && status.canManage ? html`<a class="btn btn-secondary" href="${status.connectUrl}" data-reload>Change repo access</a>` : ''}</div>
      ${error ? html`<div class="alert alert-danger" role="alert">${error}</div>` : ''}
      ${justConnected ? html`<div class="alert alert-success" role="status">GitHub is connected. Pick a repository on the New service screen.</div>` : ''}
      ${status.connected
        ? html`<section class="nj-card mb-4" aria-labelledby="conn-title">
            <h2 class="nj-card-title" id="conn-title">Connected</h2>
            <dl class="nj-help mb-0">
              <div><dt>Account</dt><dd>${status.login}</dd></div>
              <div><dt>Organisations</dt><dd>${status.organisations.length ? status.organisations.join(', ') : 'None'}</dd></div>
              <div><dt>Connected by</dt><dd>${status.connectedBy?.name ?? '—'}${status.connectedAt ? ` · ${new Date(status.connectedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}</dd></div>
            </dl>
            ${status.canManage ? html`<button type="button" class="btn btn-link btn-sm text-danger px-0 mt-2" data-disconnect>Disconnect GitHub</button>` : html`<p class="nj-meta mt-2 mb-0">Only the owner can change the connection.</p>`}
          </section>
          <section class="nj-card" aria-labelledby="repos-title">
            <h2 class="nj-card-title" id="repos-title">Repositories <span class="nj-meta">· ${repos.length}</span></h2>
            ${repos.length ? html`<div class="nj-repos">${repos.map((r) => html`<div class="nj-repo"><i class="bi bi-github" aria-hidden="true"></i>
              <div class="flex-grow-1"><div class="nj-repo-name">${r.owner} / ${r.name}</div><div class="nj-repo-meta">${r.language ?? 'Code'} · ${r.defaultBranch}</div></div>
              <span class="nj-pill nj-pill-idle">${r.private ? 'Private' : 'Public'}</span>
              <a class="btn btn-secondary btn-sm" href="/w/${workspace.id}/new/web?repo=${encodeURIComponent(r.fullName)}">Deploy</a></div>`)}</div>`
              : html`<p class="nj-meta mb-0">The connection cannot see any repositories. Change repo access to grant some.</p>`}
          </section>`
        : emptyState({
          icon: 'github',
          title: 'GitHub is not connected',
          text: status.canManage
            ? 'Connect once and everyone in this workspace can deploy from the repositories you grant.'
            : 'Ask the workspace owner to connect GitHub. Then you can deploy from its repositories.',
          action: status.canManage && status.enabled ? html`<a class="btn btn-primary" href="${status.connectUrl}" data-reload><i class="bi bi-github" aria-hidden="true"></i> Connect GitHub</a>` : '',
        })}`,

    mount(root) {
      root.querySelector('[data-disconnect]')?.addEventListener('click', async () => {
        if (!window.confirm('Disconnect GitHub? Services keep running, but new deploys from GitHub stop until you connect again.')) return;
        await api(base, { method: 'DELETE' });
        window.location.assign(`/w/${workspace.id}/github`);
      });
    },
  };
}
