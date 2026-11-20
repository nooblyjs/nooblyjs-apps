// Settings (product.md §5): the workspace's name, its members and invitations (roadmap 1.7: invite by email, remove,
// one role), and the danger zone. Owners manage; members see. The API enforces the same rules (product.md §7).
import { html } from '../html.js';
import { api } from '../api.js';
import { bindForm } from '../forms.js';
import { statusPill } from '../components/index.js';

const date = (iso) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

function membersTable(data, me) {
  return html`<div class="table-responsive"><table class="table nj-members">
    <caption class="visually-hidden">Members</caption>
    <thead><tr><th scope="col">Name</th><th scope="col">Email</th><th scope="col">Role</th><th scope="col">Since</th>${data.canManage ? html`<th scope="col"><span class="visually-hidden">Actions</span></th>` : ''}</tr></thead>
    <tbody>
      ${data.members.map((m) => html`<tr>
        <td>${m.name}${m.personId === me.id ? html` <span class="nj-meta">(you)</span>` : ''}</td>
        <td>${m.email}</td>
        <td>${m.role}</td>
        <td class="nj-num">${date(m.since)}</td>
        ${data.canManage ? html`<td class="text-end">${m.role === 'Owner' ? '' : html`<button type="button" class="btn btn-secondary btn-sm" data-remove="${m.personId}" data-name="${m.name}">Remove</button>`}</td>` : ''}
      </tr>`)}
      ${data.invitations.map((i) => html`<tr>
        <td>${statusPill('Invited')}</td>
        <td>${i.email}</td>
        <td>${i.role}</td>
        <td class="nj-num">Until ${date(i.expiresAt)}</td>
        <td class="text-end"><button type="button" class="btn btn-secondary btn-sm" data-revoke="${i.id}" data-email="${i.email}">Revoke</button></td>
      </tr>`)}
    </tbody>
  </table></div>`;
}

export function settingsPage({ workspace, me }) {
  const owner = workspace.role === 'Owner';
  return {
    title: `Settings · ${workspace.name}`,
    content: html`<div class="nj-page-head"><div><p class="nj-breadcrumb">${workspace.name}</p><h1 class="nj-title">Settings</h1>
      <p class="nj-lead">Workspace name, members and the danger zone.</p></div></div>

      <section class="nj-card mb-4" aria-labelledby="ws-title">
        <h2 class="nj-card-title" id="ws-title">Workspace</h2>
        ${owner ? html`<form novalidate data-form="rename" class="nj-inline-form">
          <div class="alert alert-danger" role="alert" tabindex="-1" data-form-alert hidden></div>
          <div class="flex-grow-1">
            <label class="form-label" for="f-ws-name">Name</label>
            <input class="form-control" id="f-ws-name" name="name" value="${workspace.name}" required maxlength="100" aria-describedby="name-error">
            <div class="invalid-feedback" id="name-error" data-for="name"></div>
          </div>
          <button type="submit" class="btn btn-secondary">Save name</button>
        </form>` : html`<p class="mb-0">${workspace.name}</p>`}
        <p class="nj-meta mt-3 mb-0">Workspace URL: <code>/w/${workspace.id}</code> (it stays the same when you rename the workspace).</p>
      </section>

      <section class="nj-card mb-4" aria-labelledby="members-title">
        <h2 class="nj-card-title" id="members-title">Members</h2>
        <div data-members><p class="nj-meta">Loading members…</p></div>
        ${owner ? html`<form novalidate data-form="invite" class="nj-inline-form mt-3">
          <div class="alert alert-danger" role="alert" tabindex="-1" data-form-alert hidden></div>
          <div class="flex-grow-1">
            <label class="form-label" for="f-invite-email">Invite by email</label>
            <input class="form-control" id="f-invite-email" name="email" type="email" required placeholder="teammate@company.com" aria-describedby="invite-hint email-error">
            <div class="form-text" id="invite-hint">They join as a Member: they can create, deploy and change services, but not invite people or manage billing.</div>
            <div class="invalid-feedback" id="email-error" data-for="email"></div>
          </div>
          <button type="submit" class="btn btn-primary">Send invitation</button>
        </form>
        <p class="nj-meta mt-2 mb-0" role="status" data-invite-status></p>` : html`<p class="nj-meta mt-3 mb-0">Only the owner can invite or remove members.</p>`}
      </section>

      <section class="nj-card nj-danger" aria-labelledby="danger-title">
        <h2 class="nj-card-title" id="danger-title">Danger zone</h2>
        <p class="mb-0 nj-meta">Deleting a workspace removes its services and data stores. It arrives with services in Phase 2.</p>
      </section>`,

    async mount(root) {
      const box = root.querySelector('[data-members]');
      const load = async () => {
        try {
          const data = await api(`/api/v1/workspaces/${encodeURIComponent(workspace.id)}/members`);
          box.innerHTML = String(membersTable(data, me));
        } catch (err) {
          box.innerHTML = String(html`<div class="alert alert-danger" role="alert">${err.message}</div>`);
        }
      };
      await load();

      box.addEventListener('click', async (event) => {
        const remove = event.target.closest('[data-remove]');
        const revoke = event.target.closest('[data-revoke]');
        if (!remove && !revoke) return;
        const [path, question] = remove
          ? [`members/${encodeURIComponent(remove.dataset.remove)}`, `Remove ${remove.dataset.name} from ${workspace.name}? They lose access straight away.`]
          : [`invitations/${encodeURIComponent(revoke.dataset.revoke)}`, `Revoke the invitation to ${revoke.dataset.email}?`];
        if (!window.confirm(question)) return;
        try {
          await api(`/api/v1/workspaces/${encodeURIComponent(workspace.id)}/${path}`, { method: 'DELETE' });
          await load();
        } catch (err) {
          window.alert(err.message);
        }
      });

      bindForm(root.querySelector('[data-form="invite"]'), {
        path: `/api/v1/workspaces/${encodeURIComponent(workspace.id)}/invitations`,
        busy: 'Sending…',
        done: async (result, form) => {
          root.querySelector('[data-invite-status]').textContent = result.emailSent
            ? `Invitation sent to ${result.email}.`
            : `Invitation created for ${result.email}, but the email could not be sent. Revoke it and try again.`;
          form.reset();
          await load();
        },
      });

      const rename = root.querySelector('[data-form="rename"]');
      bindForm(rename, {
        path: `/api/v1/workspaces/${encodeURIComponent(workspace.id)}`,
        method: 'PATCH',
        busy: 'Saving…',
        done: () => window.location.reload(),
      });
    },
  };
}
