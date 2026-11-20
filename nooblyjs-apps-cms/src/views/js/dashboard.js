import { BASE, api, escapeHtml, toSlug, formatDate, publicSiteUrl, onlineBadge, initHeader, showFatal } from './common.js';

const grid = document.getElementById('siteGrid');
const form = document.getElementById('newSiteForm');
const nameInput = document.getElementById('siteName');
const slugInput = document.getElementById('siteSlug');
const errorBox = document.getElementById('newSiteError');
let slugEdited = false;

function renderSites(sites) {
  if (!sites.length) {
    grid.innerHTML = `
      <div class="col-12">
        <div class="card empty-state">
          <i class="bi bi-window-plus"></i>
          <h2 class="mt-3 mb-1">No sites yet</h2>
          <p class="text-muted mb-4">Create your first site to start building pages.</p>
          <div><button class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#newSiteModal"><i class="bi bi-plus-lg"></i>Create a site</button></div>
        </div>
      </div>`;
    return;
  }
  grid.innerHTML = sites.map((site) => `
    <div class="col-md-6 col-xl-4">
      <div class="card card-interactive h-100">
        <div class="d-flex justify-content-between align-items-start gap-2 mb-1">
          <h2 class="card-title mb-0"><a class="card-title-link text-reset" href="${BASE}/sites/${encodeURIComponent(site.id)}">${escapeHtml(site.name)}</a></h2>
          ${onlineBadge(site.online)}
        </div>
        <p class="text-muted small mb-4">/sites/${escapeHtml(site.slug)}/ · ${site.role === 'owner' ? 'Owner' : 'Editor'}</p>
        <div class="site-stats mt-auto">
          <div><strong>${site.pageCount}</strong><span>pages</span></div>
          <div><strong>${site.viewsLast7Days}</strong><span>views (7 days)</span></div>
        </div>
        <div class="site-card-footer d-flex justify-content-between align-items-center gap-2">
          <span class="text-muted small">Updated ${formatDate(site.updatedAt)}</span>
          <div class="d-flex gap-2">
            ${site.online ? `<a class="btn btn-sm btn-link" href="${publicSiteUrl(site)}" target="_blank" rel="noopener"><i class="bi bi-box-arrow-up-right"></i>View</a>` : ''}
            <a class="btn btn-sm btn-primary" href="${BASE}/sites/${encodeURIComponent(site.id)}">Open</a>
          </div>
        </div>
      </div>
    </div>`).join('');
}

async function loadSites() {
  const { sites } = await api('/sites');
  renderSites(sites);
}

nameInput.addEventListener('input', () => {
  if (!slugEdited) slugInput.value = toSlug(nameInput.value);
});
slugInput.addEventListener('input', () => {
  slugEdited = slugInput.value.trim() !== '';
});

document.getElementById('newSiteModal').addEventListener('shown.bs.modal', () => nameInput.focus());
document.getElementById('newSiteModal').addEventListener('hidden.bs.modal', () => {
  form.reset();
  slugEdited = false;
  errorBox.classList.add('d-none');
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorBox.classList.add('d-none');
  const button = document.getElementById('createSiteBtn');
  button.disabled = true;
  try {
    const { site } = await api('/sites', {
      method: 'POST',
      body: {
        name: nameInput.value,
        slug: slugInput.value,
        description: document.getElementById('siteDescription').value
      }
    });
    window.location.href = `${BASE}/sites/${encodeURIComponent(site.id)}`;
  } catch (error) {
    errorBox.textContent = error.message;
    errorBox.classList.remove('d-none');
    button.disabled = false;
  }
});

initHeader().then(loadSites).catch(showFatal);
