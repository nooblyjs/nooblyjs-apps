import {
  BASE, api, escapeHtml, formatDate, statusBadge, toast, confirmDialog, initHeader, showFatal
} from './common.js';

const [, , , , siteId, , pageId] = window.location.pathname.split('/').map(decodeURIComponent);
const pagePath = `/sites/${encodeURIComponent(siteId)}/pages/${encodeURIComponent(pageId)}`;
const AUTOSAVE_MS = 30 * 1000;

const el = (id) => document.getElementById(id);
const state = {
  site: null,
  page: null,
  isHome: false,
  pages: [],
  ogImageMediaId: null,
  changeCount: 0,      // bumps on every edit; a save only clears "dirty" if nothing changed meanwhile
  savedChangeCount: 0,
  saving: null
};
const isDirty = () => state.changeCount !== state.savedChangeCount;

const quill = new Quill('#editor', {
  theme: 'snow',
  placeholder: 'Start writing…',
  modules: {
    toolbar: {
      container: '#toolbar',
      handlers: {
        image: () => openMediaPicker((media) => {
          const range = quill.getSelection(true);
          quill.insertEmbed(range.index, 'image', media.url, 'user');
          quill.setSelection(range.index + 1, 0, 'silent');
        })
      }
    }
  }
});

// Quill 2.0.3's getSemanticHTML() writes every space as &nbsp;, which stops text wrapping on the live site.
const editorHtml = () => quill.getSemanticHTML().replace(/&nbsp;/g, ' ');

// Save state --------------------------------------------------------------

function markChanged() {
  state.changeCount += 1;
  renderSaveState();
}

function renderSaveState(text) {
  el('saveState').textContent = text || (isDirty() ? 'Unsaved changes' : 'All changes saved');
}

function renderStatus() {
  const { page } = state;
  el('statusBadge').innerHTML = statusBadge(page.status);
  el('pageHeading').textContent = page.title;
  document.title = `${page.title} · NooblyJS CMS`;
  el('publishedInfo').textContent = page.published
    ? `Last published ${formatDate(page.published.publishedAt)} by ${page.published.publishedBy}.`
    : 'Not published yet.';
  el('unpublishBtn').disabled = !page.published && !page.scheduledAt;
  el('scheduleInfo').textContent = page.scheduledAt
    ? `Scheduled to publish ${formatDate(page.scheduledAt)}.`
    : 'Publish the current draft automatically at a set time.';
  el('clearScheduleBtn').classList.toggle('d-none', !page.scheduledAt);
  el('fieldSchedule').value = page.scheduledAt ? toLocalInput(page.scheduledAt) : '';
}

// datetime-local works in local time without a zone.
function toLocalInput(iso) {
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

// Form --------------------------------------------------------------------

function renderFields() {
  const { page, site } = state;
  el('fieldTitle').value = page.title;
  el('fieldSlug').value = page.slug;
  el('slugPrefix').textContent = `/sites/${site.slug}/`;
  el('homeSlugNote').classList.toggle('d-none', !state.isHome);
  el('fieldShowInNav').checked = page.showInNav;
  el('fieldSeoTitle').value = page.seo.title || '';
  el('fieldSeoDescription').value = page.seo.description || '';
  state.ogImageMediaId = page.seo.ogImageMediaId || null;
  renderOgImage();
  renderCounts();

  const hasChildren = state.pages.some((p) => p.parentPageId === page.id);
  const parents = state.pages.filter((p) => !p.parentPageId && p.id !== page.id);
  el('fieldParent').innerHTML = '<option value="">None (top level)</option>'
    + parents.map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.title)}</option>`).join('');
  el('fieldParent').value = page.parentPageId || '';
  el('fieldParent').disabled = hasChildren;
  el('fieldParent').title = hasChildren ? 'This page has child pages, so it stays at the top level.' : '';
}

function renderCounts() {
  el('seoTitleCount').textContent = `${el('fieldSeoTitle').value.length}/60 recommended`;
  el('seoDescriptionCount').textContent = `${el('fieldSeoDescription').value.length}/160 recommended`;
}

function renderOgImage() {
  const img = el('ogImagePreview');
  if (state.ogImageMediaId) {
    img.src = `${BASE}/media/${encodeURIComponent(state.ogImageMediaId)}`;
    img.classList.remove('d-none');
  } else {
    img.removeAttribute('src');
    img.classList.add('d-none');
  }
  el('clearOgImage').classList.toggle('d-none', !state.ogImageMediaId);
}

function collectDraft() {
  return {
    title: el('fieldTitle').value,
    slug: el('fieldSlug').value,
    parentPageId: el('fieldParent').disabled ? undefined : (el('fieldParent').value || null),
    showInNav: el('fieldShowInNav').checked,
    content: editorHtml(),
    seo: {
      title: el('fieldSeoTitle').value,
      description: el('fieldSeoDescription').value,
      ogImageMediaId: state.ogImageMediaId
    }
  };
}

function applyPage({ page, isHome }) {
  state.page = page;
  state.isHome = isHome;
  renderStatus();
}

/**
 * Saves the draft. Concurrent calls share one request; extra fields (like scheduledAt) are sent as-is.
 */
async function save({ autosave = false, extra = {} } = {}) {
  if (state.saving) await state.saving;
  const changeCount = state.changeCount;
  renderSaveState('Saving…');
  state.saving = (async () => {
    try {
      const result = await api(pagePath, { method: 'PUT', body: { ...collectDraft(), ...extra, autosave } });
      state.savedChangeCount = changeCount;
      applyPage(result);
      renderSaveState();
      return true;
    } catch (error) {
      renderSaveState('Not saved');
      toast(error.message, 'danger');
      return false;
    } finally {
      state.saving = null;
    }
  })();
  return state.saving;
}

// Publishing --------------------------------------------------------------

el('saveBtn').addEventListener('click', async () => {
  if (await save()) toast('Draft saved.');
});

el('publishBtn').addEventListener('click', async () => {
  if (isDirty() && !(await save())) return;
  try {
    applyPage(await api(`${pagePath}/publish`, { method: 'POST' }));
    toast(state.site.online ? 'Published.' : 'Published. Put the site online in Settings so visitors can see it.');
  } catch (error) {
    toast(error.message, 'danger');
  }
});

el('unpublishBtn').addEventListener('click', async () => {
  const ok = await confirmDialog({
    title: 'Unpublish page?',
    body: 'Visitors will no longer see this page. Your draft is kept, and any schedule is cancelled.',
    confirmLabel: 'Unpublish'
  });
  if (!ok) return;
  try {
    applyPage(await api(`${pagePath}/unpublish`, { method: 'POST' }));
    toast('Page unpublished.');
  } catch (error) {
    toast(error.message, 'danger');
  }
});

el('scheduleBtn').addEventListener('click', async () => {
  const value = el('fieldSchedule').value;
  if (!value) {
    toast('Choose a date and time first.', 'danger');
    return;
  }
  if (await save({ extra: { scheduledAt: new Date(value).toISOString() } })) {
    toast(`Scheduled for ${formatDate(state.page.scheduledAt)}.`);
  }
});

el('clearScheduleBtn').addEventListener('click', async () => {
  if (await save({ extra: { scheduledAt: null } })) toast('Schedule cancelled.');
});

// Versions ----------------------------------------------------------------

const versionsModal = new bootstrap.Modal(el('versionsModal'));
let selectedVersion = null;

el('versionsBtn').addEventListener('click', async () => {
  selectedVersion = null;
  el('versionMeta').textContent = 'Choose a version to preview it.';
  el('restoreVersionBtn').classList.add('d-none');
  el('versionPreview').srcdoc = '';
  el('versionList').innerHTML = '<div class="text-muted p-2">Loading…</div>';
  versionsModal.show();
  try {
    const { versions } = await api(`${pagePath}/versions`);
    const labels = { save: 'Saved', autosave: 'Autosaved', publish: 'Published', restore: 'Restored' };
    el('versionList').innerHTML = versions.length
      ? versions.map((v) => `
          <button type="button" class="list-group-item list-group-item-action" data-id="${escapeHtml(v.id)}">
            <div class="fw-semibold">${formatDate(v.savedAt)}</div>
            <div class="text-muted">${labels[v.reason] || v.reason} by ${escapeHtml(v.savedBy)}</div>
          </button>`).join('')
      : '<div class="text-muted p-2">No versions yet. A version is kept each time you save changes.</div>';
  } catch (error) {
    el('versionList').innerHTML = '';
    toast(error.message, 'danger');
  }
});

el('versionList').addEventListener('click', async (event) => {
  const item = event.target.closest('[data-id]');
  if (!item) return;
  el('versionList').querySelectorAll('.active').forEach((n) => n.classList.remove('active'));
  item.classList.add('active');
  try {
    const { version } = await api(`${pagePath}/versions/${encodeURIComponent(item.dataset.id)}`);
    selectedVersion = version;
    el('versionMeta').textContent = `"${version.title}" · ${formatDate(version.savedAt)}`;
    el('restoreVersionBtn').classList.remove('d-none');
    // Sandboxed (no scripts); stored content is already sanitised by the server.
    el('versionPreview').srcdoc = `<!DOCTYPE html><html><head><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"><link rel="stylesheet" href="${BASE}/assets/css/site.css"></head><body><main class="container site-content">${version.content}</main></body></html>`;
  } catch (error) {
    toast(error.message, 'danger');
  }
});

el('restoreVersionBtn').addEventListener('click', async () => {
  if (!selectedVersion) return;
  if (isDirty()) {
    const ok = await confirmDialog({
      title: 'Discard unsaved changes?',
      body: 'Restoring replaces the current draft. Your unsaved changes will be lost.',
      confirmLabel: 'Restore anyway',
      danger: true
    });
    if (!ok) return;
  }
  try {
    const result = await api(`${pagePath}/versions/${encodeURIComponent(selectedVersion.id)}/restore`, { method: 'POST' });
    applyPage(result);
    loadIntoEditor();
    versionsModal.hide();
    toast('Version restored to the draft. Publish to make it live.');
  } catch (error) {
    toast(error.message, 'danger');
  }
});

// Media picker ------------------------------------------------------------

const mediaModal = new bootstrap.Modal(el('mediaModal'));
let onPick = null;

async function renderPicker() {
  const grid = el('pickerGrid');
  grid.innerHTML = '<div class="col-12 text-muted">Loading…</div>';
  const { media } = await api(`/sites/${encodeURIComponent(siteId)}/media`);
  const images = media.filter((m) => m.mimeType.startsWith('image/'));
  grid.innerHTML = images.length
    ? images.map((m) => `
        <div class="col-4 col-md-3">
          <img src="${m.url}" class="img-fluid rounded picker-item media-thumb w-100" tabindex="0" role="button"
            alt="${escapeHtml(m.originalName)}" data-id="${escapeHtml(m.id)}" data-url="${escapeHtml(m.url)}">
        </div>`).join('')
    : '<div class="col-12 text-muted">No images yet. Upload one to use it.</div>';
}

function openMediaPicker(callback) {
  onPick = callback;
  mediaModal.show();
  renderPicker().catch((error) => toast(error.message, 'danger'));
}

function pick(target) {
  const item = target.closest('[data-id]');
  if (!item || !onPick) return;
  const callback = onPick;
  onPick = null;
  mediaModal.hide();
  callback({ id: item.dataset.id, url: item.dataset.url });
}

el('pickerGrid').addEventListener('click', (event) => pick(event.target));
el('pickerGrid').addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    pick(event.target);
  }
});

el('pickerUpload').addEventListener('change', async (event) => {
  const [file] = event.target.files;
  event.target.value = '';
  if (!file) return;
  const body = new FormData();
  body.append('file', file);
  el('pickerUploadLabel').textContent = 'Uploading…';
  try {
    await api(`/sites/${encodeURIComponent(siteId)}/media`, { method: 'POST', body });
    await renderPicker();
  } catch (error) {
    toast(error.message, 'danger');
  } finally {
    el('pickerUploadLabel').textContent = 'Upload';
  }
});

el('chooseOgImage').addEventListener('click', () => openMediaPicker((media) => {
  state.ogImageMediaId = media.id;
  renderOgImage();
  markChanged();
}));

el('clearOgImage').addEventListener('click', () => {
  state.ogImageMediaId = null;
  renderOgImage();
  markChanged();
});

// Wiring ------------------------------------------------------------------

function loadIntoEditor() {
  quill.setContents(quill.clipboard.convert({ html: state.page.content || '' }), 'silent');
  quill.history.clear();
  renderFields();
  state.savedChangeCount = state.changeCount;
  renderSaveState();
}

quill.on('text-change', (delta, old, source) => {
  if (source === 'user') markChanged();
});

['fieldTitle', 'fieldSlug', 'fieldSeoTitle', 'fieldSeoDescription'].forEach((id) => {
  el(id).addEventListener('input', () => {
    markChanged();
    renderCounts();
    if (id === 'fieldTitle') el('pageHeading').textContent = el('fieldTitle').value || 'Untitled';
  });
});
['fieldParent', 'fieldShowInNav'].forEach((id) => el(id).addEventListener('change', markChanged));

document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    event.preventDefault();
    save();
  }
});

window.addEventListener('beforeunload', (event) => {
  if (isDirty()) {
    event.preventDefault();
    event.returnValue = '';
  }
});

setInterval(() => {
  if (isDirty() && !state.saving) save({ autosave: true });
}, AUTOSAVE_MS);

async function start() {
  await initHeader();
  const [{ site }, { pages }, pageResult] = await Promise.all([
    api(`/sites/${encodeURIComponent(siteId)}`),
    api(`/sites/${encodeURIComponent(siteId)}/pages`),
    api(pagePath)
  ]);
  state.site = site;
  state.pages = pages;
  applyPage(pageResult);
  el('backLink').href = `${BASE}/sites/${encodeURIComponent(siteId)}`;
  el('backLabel').textContent = `Back to ${site.name}`;
  el('previewBtn').href = `${BASE}/preview/${encodeURIComponent(siteId)}/${encodeURIComponent(pageId)}`;
  loadIntoEditor();
}

// Preview shows the saved draft, so save first if there are changes.
el('previewBtn').addEventListener('click', async (event) => {
  if (!isDirty()) return;
  event.preventDefault();
  const preview = window.open('about:blank', '_blank');
  await save();
  if (preview) preview.location.href = el('previewBtn').href;
});

start().catch(showFatal);
