import { BASE, api, escapeHtml, toSlug, formatDate, publicSiteUrl, initHeader, showFatal } from './common.js';

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
        <div class="card border-0 shadow-sm"><div class="card-body text-center py-5">
          <i class="bi bi-window-plus display-5 text-primary"></i>
          <h2 class="h5 mt-3">No sites yet</h2>
          <p class="text-muted">Create your first site to start building pages.</p>
          <button class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#newSiteModal">Create a site</button>
        </div></div>
      </div>`;
    return;
  }
  grid.innerHTML = sites.map((site) => `
    <div class="col-md-6 col-lg-4">
      <div class="card h-100 site-card border-0 shadow-sm">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-start mb-2">
            <h2 class="h5 card-title mb-0">${escapeHtml(site.name)}</h2>
            ${site.online ? '<span class="badge text-bg-success">Online</span>' : '<span class="badge text-bg-secondary">Offline</span>'}
          </div>
          <p class="text-muted small mb-3">/sites/${escapeHtml(site.slug)}/ · ${site.role === 'owner' ? 'Owner' : 'Editor'}</p>
          <div class="d-flex gap-4 small">
            <div><div class="fw-semibold">${site.pageCount}</div><div class="text-muted">pages</div></div>
            <div><div class="fw-semibold">${site.viewsLast7Days}</div><div class="text-muted">views (7 days)</div></div>
          </div>
        </div>
        <div class="card-footer bg-transparent border-0 d-flex justify-content-between align-items-center pb-3">
          <span class="text-muted small">Updated ${formatDate(site.updatedAt)}</span>
          <div class="d-flex gap-2">
            ${site.online ? `<a class="btn btn-sm btn-outline-secondary" href="${publicSiteUrl(site)}" target="_blank" rel="noopener">View</a>` : ''}
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
