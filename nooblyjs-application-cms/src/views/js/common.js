/**
 * Shared helpers for the CMS screens: API calls, the header, toasts and confirm dialogs.
 */

export const BASE = '/applications/cms';
const API = `${BASE}/api`;

/**
 * Calls the CMS API. Sends JSON (or FormData) and returns the parsed response.
 * Redirects to sign-in on 401 and throws an Error with the server's message otherwise.
 * @param {string} path e.g. '/sites'
 * @param {{method?: string, body?: Object|FormData}} [options]
 * @return {Promise<Object|null>}
 */
export async function api(path, { method = 'GET', body } = {}) {
  const init = { method, headers: {}, credentials: 'same-origin' };
  if (body instanceof FormData) {
    init.body = body;
  } else if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  const response = await fetch(`${API}${path}`, init);
  if (response.status === 401) {
    window.location.href = `/services/authservice/views/login.html?returnUrl=${encodeURIComponent(window.location.pathname)}`;
    throw new Error('Please sign in.');
  }
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((data.error && data.error.message) || `Request failed (${response.status})`);
  }
  return data;
}

export function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function toSlug(value = '') {
  return value.toString().trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const STATUS_BADGES = {
  draft: ['text-bg-secondary', 'Draft'],
  published: ['text-bg-success', 'Published'],
  changed: ['text-bg-warning', 'Unpublished changes'],
  scheduled: ['text-bg-info', 'Scheduled']
};

export function statusBadge(status) {
  const [cls, label] = STATUS_BADGES[status] || ['text-bg-light', status];
  return `<span class="badge ${cls}">${label}</span>`;
}

export function publicSiteUrl(site) {
  return `/sites/${encodeURIComponent(site.slug)}/`;
}

/**
 * Shows a short message in the bottom-right corner.
 * @param {string} message
 * @param {'success'|'danger'|'info'} [type]
 */
export function toast(message, type = 'success') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container position-fixed bottom-0 end-0 p-3';
    document.body.appendChild(container);
  }
  const el = document.createElement('div');
  el.className = `toast align-items-center text-bg-${type} border-0`;
  el.setAttribute('role', type === 'danger' ? 'alert' : 'status');
  el.innerHTML = `<div class="d-flex"><div class="toast-body"></div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button></div>`;
  el.querySelector('.toast-body').textContent = message;
  container.appendChild(el);
  const instance = new bootstrap.Toast(el, { delay: type === 'danger' ? 6000 : 3000 });
  el.addEventListener('hidden.bs.toast', () => el.remove());
  instance.show();
}

/**
 * Shows a Bootstrap confirm dialog.
 * @param {{title: string, body: string, confirmLabel?: string, danger?: boolean}} options body is plain text
 * @return {Promise<boolean>}
 */
export function confirmDialog({ title, body, confirmLabel = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'modal fade';
    el.tabIndex = -1;
    el.innerHTML = `
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header"><h5 class="modal-title"></h5><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button></div>
          <div class="modal-body"><p class="mb-0"></p></div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-confirm></button>
          </div>
        </div>
      </div>`;
    el.querySelector('.modal-title').textContent = title;
    el.querySelector('.modal-body p').textContent = body;
    el.querySelector('[data-confirm]').textContent = confirmLabel;
    document.body.appendChild(el);
    const modal = new bootstrap.Modal(el);
    let confirmed = false;
    el.querySelector('[data-confirm]').addEventListener('click', () => {
      confirmed = true;
      modal.hide();
    });
    el.addEventListener('hidden.bs.modal', () => {
      el.remove();
      resolve(confirmed);
    });
    modal.show();
  });
}

async function signOut() {
  try {
    await fetch('/services/authservice/api/logout', { method: 'POST', credentials: 'same-origin' });
  } finally {
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    window.location.href = `/services/authservice/views/login.html?returnUrl=${encodeURIComponent(`${BASE}/`)}`;
  }
}

/**
 * Loads the signed-in user and fills the shared header.
 * @return {Promise<{user: Object, fonts: Array}>}
 */
export async function initHeader() {
  const me = await api('/me');
  const nameEl = document.getElementById('currentUser');
  if (nameEl) nameEl.textContent = me.user.name;
  const signOutBtn = document.getElementById('signOutBtn');
  if (signOutBtn) signOutBtn.addEventListener('click', signOut);
  return me;
}

/**
 * Shows an error message in place of a screen's main content.
 */
export function showFatal(error) {
  const main = document.querySelector('main');
  if (!main) return;
  main.innerHTML = `<div class="alert alert-danger mt-4" role="alert"></div>`;
  main.querySelector('.alert').textContent = error.message || String(error);
}
