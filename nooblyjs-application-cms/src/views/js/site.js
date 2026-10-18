import {
  BASE, api, escapeHtml, formatDate, formatBytes, statusBadge, publicSiteUrl,
  toast, confirmDialog, initHeader, showFatal
} from './common.js';

const siteId = decodeURIComponent(window.location.pathname.split('/')[4]);
const state = { site: null, pages: [], media: [], fonts: [] };

const pageUrl = (page) => `${BASE}/sites/${encodeURIComponent(siteId)}/pages/${encodeURIComponent(page.id)}`;
const previewUrl = (page) => `${BASE}/preview/${encodeURIComponent(siteId)}/${encodeURIComponent(page.id)}`;
const isOwner = () => state.site.role === 'owner';

// Header ------------------------------------------------------------------

function renderHeader() {
  const { site } = state;
  document.title = `${site.name} · NooblyJS CMS`;
  document.getElementById('crumbSite').textContent = site.name;
  document.getElementById('siteTitle').textContent = site.name;
  document.getElementById('siteOnlineBadge').innerHTML = site.online
    ? '<span class="badge text-bg-success">Online</span>'
    : '<span class="badge text-bg-secondary">Offline</span>';
  const home = state.pages.find((p) => p.id === site.homePageId);
  document.getElementById('siteActions').innerHTML = `
    ${home ? `<a class="btn btn-outline-secondary btn-sm" href="${previewUrl(home)}" target="_blank" rel="noopener"><i class="bi bi-eye me-1"></i>Preview</a>` : ''}
    ${site.online ? `<a class="btn btn-outline-primary btn-sm" href="${publicSiteUrl(site)}" target="_blank" rel="noopener"><i class="bi bi-box-arrow-up-right me-1"></i>View live site</a>` : ''}`;
  document.querySelectorAll('.owner-only').forEach((el) => el.classList.toggle('d-none', !isOwner()));
}

// Pages -------------------------------------------------------------------

// Parents first, each followed by its children, all in saved order.
function treeOrder(pages) {
  const ids = new Set(pages.map((p) => p.id));
  const roots = pages.filter((p) => !p.parentPageId || !ids.has(p.parentPageId));
  return roots.flatMap((root) => [root, ...pages.filter((p) => p.parentPageId === root.id)]);
}

function renderPages() {
  const rows = treeOrder(state.pages);
  const tbody = document.getElementById('pageRows');
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-muted">No pages yet.</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map((page) => {
    const isHome = page.id === state.site.homePageId;
    const isChild = Boolean(page.parentPageId);
    return `
      <tr class="${isChild ? 'page-row-child' : ''}" data-id="${escapeHtml(page.id)}">
        <td>
          ${isChild ? '<i class="bi bi-arrow-return-right text-muted me-1"></i>' : ''}
          <a href="${pageUrl(page)}" class="fw-semibold text-decoration-none">${escapeHtml(page.title)}</a>
          ${isHome ? '<span class="badge text-bg-primary ms-1">Home</span>' : ''}
        </td>
        <td class="small text-muted">${isHome ? '/' : `/${escapeHtml(page.slug)}`}</td>
        <td>${statusBadge(page.status)}${page.status === 'scheduled' ? `<div class="small text-muted">${formatDate(page.scheduledAt)}</div>` : ''}</td>
        <td class="small text-muted">${formatDate(page.updatedAt)}</td>
        <td class="text-center">${page.showInNav ? '<i class="bi bi-check-lg text-success" aria-label="Yes"></i>' : '<i class="bi bi-dash text-muted" aria-label="No"></i>'}</td>
        <td class="text-end text-nowrap">
          <button class="btn btn-sm btn-link text-secondary px-1" data-action="up" title="Move up" aria-label="Move up"><i class="bi bi-arrow-up"></i></button>
          <button class="btn btn-sm btn-link text-secondary px-1" data-action="down" title="Move down" aria-label="Move down"><i class="bi bi-arrow-down"></i></button>
          <a class="btn btn-sm btn-outline-primary" href="${pageUrl(page)}">Edit</a>
          <div class="btn-group">
            <button class="btn btn-sm btn-outline-secondary dropdown-toggle" data-bs-toggle="dropdown" aria-expanded="false" aria-label="More actions"></button>
            <ul class="dropdown-menu dropdown-menu-end">
              <li><a class="dropdown-item" href="${previewUrl(page)}" target="_blank" rel="noopener">Preview</a></li>
              ${state.site.online && page.status !== 'draft' && page.status !== 'scheduled' ? `<li><a class="dropdown-item" href="${publicSiteUrl(state.site)}${isHome ? '' : encodeURIComponent(page.slug)}" target="_blank" rel="noopener">View live</a></li>` : ''}
              ${!isHome && isOwner() && !isChild ? '<li><button class="dropdown-item" data-action="home">Make home page</button></li>' : ''}
              ${!isHome ? '<li><hr class="dropdown-divider"></li><li><button class="dropdown-item text-danger" data-action="delete">Delete</button></li>' : ''}
            </ul>
          </div>
        </td>
      </tr>`;
  }).join('');
}

async function loadPages() {
  const { pages, homePageId } = await api(`/sites/${siteId}/pages`);
  state.pages = pages;
  state.site.homePageId = homePageId;
  renderPages();
  renderHeader();
}

// Moves a page up/down among its siblings, then saves the full order.
async function movePage(pageId, direction) {
  const page = state.pages.find((p) => p.id === pageId);
  const siblings = state.pages.filter((p) => (p.parentPageId || null) === (page.parentPageId || null));
  const index = siblings.indexOf(page);
  const swapWith = siblings[index + (direction === 'up' ? -1 : 1)];
  if (!swapWith) return;
  const ordered = [...state.pages];
  const a = ordered.indexOf(page);
  const b = ordered.indexOf(swapWith);
  [ordered[a], ordered[b]] = [ordered[b], ordered[a]];
  const { pages } = await api(`/sites/${siteId}/pages/order`, { method: 'PUT', body: { pageIds: ordered.map((p) => p.id) } });
  state.pages = pages;
  renderPages();
}

document.getElementById('pageRows').addEventListener('click', async (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const pageId = button.closest('tr').dataset.id;
  const page = state.pages.find((p) => p.id === pageId);
  try {
    if (button.dataset.action === 'up' || button.dataset.action === 'down') {
      await movePage(pageId, button.dataset.action);
    } else if (button.dataset.action === 'home') {
      await api(`/sites/${siteId}/pages/${pageId}/home`, { method: 'POST' });
      await loadPages();
      toast(`"${page.title}" is now the home page.`);
    } else if (button.dataset.action === 'delete') {
      const ok = await confirmDialog({
        title: 'Delete page?',
        body: `"${page.title}" and its version history will be deleted. Child pages move to the top level.`,
        confirmLabel: 'Delete page',
        danger: true
      });
      if (!ok) return;
      await api(`/sites/${siteId}/pages/${pageId}`, { method: 'DELETE' });
      await loadPages();
      toast('Page deleted.');
    }
  } catch (error) {
    toast(error.message, 'danger');
  }
});

const newPageModal = document.getElementById('newPageModal');
newPageModal.addEventListener('show.bs.modal', () => {
  const parents = state.pages.filter((p) => !p.parentPageId);
  document.getElementById('pageParent').innerHTML = '<option value="">None (top level)</option>'
    + parents.map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.title)}</option>`).join('');
});
newPageModal.addEventListener('shown.bs.modal', () => document.getElementById('pageTitle').focus());
newPageModal.addEventListener('hidden.bs.modal', () => {
  document.getElementById('newPageForm').reset();
  document.getElementById('newPageError').classList.add('d-none');
});

document.getElementById('newPageForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const errorBox = document.getElementById('newPageError');
  errorBox.classList.add('d-none');
  try {
    const { page } = await api(`/sites/${siteId}/pages`, {
      method: 'POST',
      body: {
        title: document.getElementById('pageTitle').value,
        parentPageId: document.getElementById('pageParent').value || null
      }
    });
    window.location.href = pageUrl(page);
  } catch (error) {
    errorBox.textContent = error.message;
    errorBox.classList.remove('d-none');
  }
});

// Media -------------------------------------------------------------------

function renderMedia() {
  const grid = document.getElementById('mediaGrid');
  if (!state.media.length) {
    grid.innerHTML = '<div class="col-12 text-muted">No media yet. Uploaded files appear here.</div>';
    return;
  }
  grid.innerHTML = state.media.map((m) => `
    <div class="col-6 col-md-4 col-lg-3" data-id="${escapeHtml(m.id)}">
      <div class="card h-100 border-0 shadow-sm">
        ${m.mimeType.startsWith('image/')
    ? `<img src="${m.url}" class="card-img-top media-thumb" alt="${escapeHtml(m.originalName)}" loading="lazy">`
    : '<div class="media-thumb-pdf card-img-top"><i class="bi bi-file-earmark-pdf"></i></div>'}
        <div class="card-body p-2">
          <div class="small text-truncate" title="${escapeHtml(m.originalName)}">${escapeHtml(m.originalName)}</div>
          <div class="small text-muted">${formatBytes(m.size)}</div>
        </div>
        <div class="card-footer bg-transparent border-0 p-2 pt-0 d-flex gap-1">
          <button class="btn btn-sm btn-outline-secondary flex-fill" data-action="copy">Copy link</button>
          <button class="btn btn-sm btn-outline-danger" data-action="delete" aria-label="Delete"><i class="bi bi-trash"></i></button>
        </div>
      </div>
    </div>`).join('');
}

async function loadMedia() {
  const { media } = await api(`/sites/${siteId}/media`);
  state.media = media;
  renderMedia();
  renderLogoOptions();
}

document.getElementById('mediaUpload').addEventListener('change', async (event) => {
  const files = [...event.target.files];
  event.target.value = '';
  const label = document.getElementById('uploadLabel');
  for (const [index, file] of files.entries()) {
    label.textContent = `Uploading ${index + 1} of ${files.length}…`;
    const body = new FormData();
    body.append('file', file);
    try {
      await api(`/sites/${siteId}/media`, { method: 'POST', body });
    } catch (error) {
      toast(`${file.name}: ${error.message}`, 'danger');
    }
  }
  label.textContent = 'Upload files';
  await loadMedia();
});

document.getElementById('mediaGrid').addEventListener('click', async (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const media = state.media.find((m) => m.id === button.closest('[data-id]').dataset.id);
  if (button.dataset.action === 'copy') {
    try {
      await navigator.clipboard.writeText(new URL(media.url, window.location.origin).href);
      toast('Link copied.');
    } catch (error) {
      toast('Could not copy the link.', 'danger');
    }
    return;
  }
  const ok = await confirmDialog({
    title: 'Delete file?',
    body: `"${media.originalName}" will be deleted. Pages that show it will have a broken image.`,
    confirmLabel: 'Delete file',
    danger: true
  });
  if (!ok) return;
  try {
    await api(`/sites/${siteId}/media/${media.id}`, { method: 'DELETE' });
    await loadMedia();
    toast('File deleted.');
  } catch (error) {
    toast(error.message, 'danger');
  }
});

// Settings ----------------------------------------------------------------

function renderLogoOptions() {
  const select = document.getElementById('setLogo');
  const images = state.media.filter((m) => m.mimeType.startsWith('image/'));
  select.innerHTML = '<option value="">No logo</option>'
    + images.map((m) => `<option value="${escapeHtml(m.id)}">${escapeHtml(m.originalName)}</option>`).join('');
  select.value = state.site.settings.logoMediaId || '';
}

function renderSettings() {
  const { site, fonts } = state;
  const s = site.settings;
  document.getElementById('setName').value = site.name;
  document.getElementById('setSlug').value = site.slug;
  document.getElementById('setDescription').value = site.description || '';
  document.getElementById('setPrimary').value = s.primaryColor;
  document.getElementById('setBackground').value = s.backgroundColor;
  document.getElementById('setText').value = s.textColor;
  const fontOptions = fonts.map((f) => `<option value="${escapeHtml(f.id)}">${escapeHtml(f.label)}</option>`).join('');
  document.getElementById('setHeadingFont').innerHTML = fontOptions;
  document.getElementById('setBodyFont').innerHTML = fontOptions;
  document.getElementById('setHeadingFont').value = s.headingFont;
  document.getElementById('setBodyFont').value = s.bodyFont;
  document.getElementById('setFooter').value = s.footerText || '';
  document.getElementById('deleteSlugHint').textContent = site.slug;
  renderLogoOptions();
  renderOnline();
}

function renderOnline() {
  const { site } = state;
  document.getElementById('onlineHelp').textContent = site.online
    ? 'The site is online. Visitors can see its published pages.'
    : 'The site is offline. Its public address shows "page not found".';
  const button = document.getElementById('toggleOnlineBtn');
  button.textContent = site.online ? 'Take site offline' : 'Put site online';
  button.className = site.online ? 'btn btn-outline-danger' : 'btn btn-success';
}

document.getElementById('settingsForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const errorBox = document.getElementById('settingsError');
  errorBox.classList.add('d-none');
  try {
    const { site } = await api(`/sites/${siteId}`, {
      method: 'PUT',
      body: {
        name: document.getElementById('setName').value,
        slug: document.getElementById('setSlug').value,
        description: document.getElementById('setDescription').value,
        settings: {
          primaryColor: document.getElementById('setPrimary').value,
          backgroundColor: document.getElementById('setBackground').value,
          textColor: document.getElementById('setText').value,
          headingFont: document.getElementById('setHeadingFont').value,
          bodyFont: document.getElementById('setBodyFont').value,
          logoMediaId: document.getElementById('setLogo').value || null,
          footerText: document.getElementById('setFooter').value
        }
      }
    });
    state.site = site;
    renderHeader();
    renderSettings();
    toast('Settings saved.');
  } catch (error) {
    errorBox.textContent = error.message;
    errorBox.classList.remove('d-none');
  }
});

document.getElementById('toggleOnlineBtn').addEventListener('click', async () => {
  try {
    const { site } = await api(`/sites/${siteId}/online`, { method: 'POST', body: { online: !state.site.online } });
    state.site = site;
    renderHeader();
    renderOnline();
    renderPages();
    toast(site.online ? 'The site is online.' : 'The site is offline.');
  } catch (error) {
    toast(error.message, 'danger');
  }
});

document.getElementById('deleteConfirm').addEventListener('input', (event) => {
  document.getElementById('deleteSiteBtn').disabled = event.target.value.trim() !== state.site.slug;
});

document.getElementById('deleteSiteBtn').addEventListener('click', async () => {
  try {
    await api(`/sites/${siteId}`, { method: 'DELETE' });
    window.location.href = `${BASE}/`;
  } catch (error) {
    toast(error.message, 'danger');
  }
});

// Members -----------------------------------------------------------------

function renderMembers() {
  const { site } = state;
  const owner = `<li class="list-group-item d-flex justify-content-between align-items-center">
      <span>${escapeHtml(site.ownerEmail)}</span><span class="badge text-bg-primary">Owner</span></li>`;
  const members = (site.members || []).map((m) => `
    <li class="list-group-item d-flex justify-content-between align-items-center" data-email="${escapeHtml(m.email)}">
      <span>${escapeHtml(m.email)}</span>
      <span><span class="badge text-bg-light me-2">Editor</span><button class="btn btn-sm btn-outline-danger" data-action="remove">Remove</button></span>
    </li>`).join('');
  document.getElementById('memberList').innerHTML = owner + (members || '<li class="list-group-item text-muted small">No editors yet.</li>');
}

document.getElementById('memberForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const errorBox = document.getElementById('memberError');
  errorBox.classList.add('d-none');
  try {
    const input = document.getElementById('memberEmail');
    const { site } = await api(`/sites/${siteId}/members`, { method: 'POST', body: { email: input.value } });
    state.site = site;
    input.value = '';
    renderMembers();
    toast('Editor added.');
  } catch (error) {
    errorBox.textContent = error.message;
    errorBox.classList.remove('d-none');
  }
});

document.getElementById('memberList').addEventListener('click', async (event) => {
  const button = event.target.closest('[data-action="remove"]');
  if (!button) return;
  const email = button.closest('[data-email]').dataset.email;
  try {
    const { site } = await api(`/sites/${siteId}/members/${encodeURIComponent(email)}`, { method: 'DELETE' });
    state.site = site;
    renderMembers();
    toast('Editor removed.');
  } catch (error) {
    toast(error.message, 'danger');
  }
});

// Start -------------------------------------------------------------------

async function start() {
  const me = await initHeader();
  state.fonts = me.fonts;
  const { site } = await api(`/sites/${siteId}`);
  state.site = site;
  await loadPages();
  await loadMedia();
  renderSettings();
  renderMembers();
  if (window.location.hash === '#media') {
    bootstrap.Tab.getOrCreateInstance(document.getElementById('mediaTabBtn')).show();
  }
}

start().catch(showFatal);
