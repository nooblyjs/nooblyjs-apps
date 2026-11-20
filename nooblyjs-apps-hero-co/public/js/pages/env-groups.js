// Environment groups (roadmap 2.6): variables shared by many services, linked once. A group lists its keys (values are
// write-only, with an audited reveal) and the services that link it; changing a group redeploys them.
import { html } from '../html.js';
import { api } from '../api.js';
import { showErrors } from '../forms.js';
import { emptyState } from '../components/index.js';

function varRows(prefix, vars) {
  return html`${vars.map((v, i) => html`<div class="nj-env-row" data-var-row>
    <label class="visually-hidden" for="${prefix}-${i}-key">Key</label>
    <input class="form-control nj-mono" id="${prefix}-${i}-key" name="vars.${i}.key" value="${v.key}" placeholder="KEY" autocomplete="off" spellcheck="false"${v.kept ? html` readonly` : ''}>
    <label class="visually-hidden" for="${prefix}-${i}-value">Value</label>
    <input class="form-control nj-mono" id="${prefix}-${i}-value" name="vars.${i}.value" type="password" placeholder="${v.kept ? 'Unchanged' : 'value'}" autocomplete="off" spellcheck="false"${v.kept ? html` data-kept` : ''}>
    <button type="button" class="btn btn-secondary" data-var-remove aria-label="Remove ${v.key || 'variable'}"><i class="bi bi-trash3" aria-hidden="true"></i></button>
    <div class="invalid-feedback" data-for="vars.${i}.key"></div><div class="invalid-feedback" data-for="vars.${i}.value"></div>
  </div>`)}`;
}

function groupForm(group) {
  const id = group?.id ?? 'new';
  return html`<form novalidate class="nj-stack-gap" data-group-form="${id}">
    <div class="alert alert-danger" role="alert" tabindex="-1" data-form-alert hidden></div>
    ${group ? '' : html`<div><label class="form-label" for="g-new-name">Group name</label>
      <input class="form-control" id="g-new-name" name="name" maxlength="60" required placeholder="shared-secrets" aria-describedby="g-name-error">
      <div class="invalid-feedback" id="g-name-error" data-for="name"></div></div>`}
    <div class="nj-env" data-vars>${varRows(`g-${id}`, group ? group.vars.map((v) => ({ key: v.key, kept: true })) : [{ key: '' }])}</div>
    <div class="invalid-feedback d-block" data-for="vars"></div>
    <div class="d-flex flex-wrap gap-2">
      <button type="button" class="btn btn-secondary btn-sm" data-var-add><i class="bi bi-plus-lg" aria-hidden="true"></i> Add variable</button>
      <button type="submit" class="btn btn-primary btn-sm">${group ? 'Save and redeploy linked services' : 'Create group'}</button>
      ${group ? html`<button type="button" class="btn btn-link btn-sm text-danger" data-group-delete>Delete group</button>` : ''}
    </div>
    <p class="nj-meta mb-0" role="status" data-group-status></p>
  </form>`;
}

function groupCard(g) {
  return html`<section class="nj-card" aria-labelledby="g-${g.id}-title" data-group="${g.id}" data-name="${g.name}">
    <div class="d-flex justify-content-between flex-wrap gap-2 mb-3">
      <h2 class="nj-card-title mb-0" id="g-${g.id}-title">${g.name}</h2>
      <span class="nj-meta">${g.vars.length} variable${g.vars.length === 1 ? '' : 's'} · ${g.services.length ? `linked to ${g.services.join(', ')}` : 'not linked yet'}</span>
    </div>
    ${g.vars.length ? html`<ul class="list-unstyled nj-env-keys mb-3">${g.vars.map((v) => html`<li><code>${v.key}</code> <span class="nj-meta" data-value-for="${v.key}">••••••••</span>
      <button type="button" class="btn btn-link btn-sm" data-reveal="${v.key}">Reveal</button></li>`)}</ul>` : ''}
    <details><summary class="btn btn-secondary btn-sm">Edit variables</summary><div class="mt-3">${groupForm(g)}</div></details>
  </section>`;
}

export async function envGroupsPage({ workspace }) {
  const base = `/api/v1/workspaces/${encodeURIComponent(workspace.id)}/env-groups`;
  const { groups } = await api(base);
  return {
    title: `Environment groups · ${workspace.name}`,
    content: html`<div class="nj-page-head"><div><p class="nj-breadcrumb">${workspace.name}</p><h1 class="nj-title">Environment groups</h1>
        <p class="nj-lead">Variables shared by many services, linked once. Change a group and every service that links it redeploys.</p></div></div>
      <div class="nj-stack-gap-lg">
        ${groups.length ? groups.map(groupCard) : emptyState({ icon: 'sliders', title: 'No environment groups yet', text: 'Make one for the secrets several services share, such as a database URL or an API key.' })}
        <section class="nj-card" aria-labelledby="g-new-title"><h2 class="nj-card-title" id="g-new-title">New environment group</h2>${groupForm(null)}</section>
      </div>`,

    mount(root) {
      const counters = new WeakMap();
      root.addEventListener('click', async (e) => {
        const form = e.target.closest('form[data-group-form]');
        if (e.target.closest('[data-var-add]') && form) {
          const box = form.querySelector('[data-vars]');
          const n = counters.get(form) ?? box.children.length;
          counters.set(form, n + 1);
          box.insertAdjacentHTML('beforeend', String(varRows(`g-${form.dataset.groupForm}-x${n}`, [{ key: '' }])));
          box.lastElementChild.querySelector('input').focus();
          return;
        }
        if (e.target.closest('[data-var-remove]')) return e.target.closest('[data-var-row]').remove();
        const card = e.target.closest('[data-group]');
        if (e.target.closest('[data-group-delete]') && card) {
          if (!window.confirm(`Delete the environment group ${card.dataset.name}?`)) return;
          try {
            await api(`${base}/${encodeURIComponent(card.dataset.group)}`, { method: 'DELETE' });
            window.location.reload();
          } catch (err) {
            card.querySelector('[data-group-status]').textContent = err.message;
          }
          return;
        }
        const reveal = e.target.closest('[data-reveal]');
        if (reveal && card) {
          const key = reveal.dataset.reveal;
          const confirm = window.prompt(`Type ${card.dataset.name} to reveal ${key}. This is recorded.`);
          if (confirm === null) return;
          try {
            const { value } = await api(`${base}/${encodeURIComponent(card.dataset.group)}/vars/${encodeURIComponent(key)}/reveal`, { method: 'POST', body: { confirm } });
            const out = card.querySelector(`[data-value-for="${CSS.escape(key)}"]`);
            out.textContent = value;
            out.classList.add('nj-mono');
            reveal.remove();
          } catch (err) {
            window.alert(err.details?.[0]?.message ?? err.message);
          }
        }
      });

      root.addEventListener('submit', async (e) => {
        const form = e.target.closest('form[data-group-form]');
        if (!form) return;
        e.preventDefault();
        for (const el of form.querySelectorAll('.is-invalid')) el.classList.remove('is-invalid');
        for (const el of form.querySelectorAll('.invalid-feedback')) el.textContent = '';
        const rows = [...form.querySelectorAll('[data-var-row]')];
        rows.forEach((row, i) => {
          const [k, v] = row.querySelectorAll('input');
          k.name = `vars.${i}.key`;
          v.name = `vars.${i}.value`;
          const [fk, fv] = row.querySelectorAll('.invalid-feedback');
          fk.dataset.for = `vars.${i}.key`;
          fv.dataset.for = `vars.${i}.value`;
        });
        const vars = rows.map((row) => {
          const [k, v] = row.querySelectorAll('input');
          // A kept row left empty keeps its stored value.
          return v.hasAttribute('data-kept') && v.value === '' ? { key: k.value.trim() } : { key: k.value.trim(), value: v.value };
        }).filter((v) => v.key || v.value);
        const id = form.dataset.groupForm;
        try {
          if (id === 'new') {
            await api(base, { method: 'POST', body: { name: form.elements.namedItem('name').value.trim(), vars } });
          } else {
            const res = await api(`${base}/${encodeURIComponent(id)}`, { method: 'PUT', body: { vars } });
            form.querySelector('[data-group-status]').textContent = res.redeploying.length ? `Saved. Redeploying ${res.redeploying.join(', ')}.` : 'Saved.';
            await new Promise((r) => setTimeout(r, 900));
          }
          window.location.reload();
        } catch (err) {
          showErrors(form, err);
        }
      });
    },
  };
}
