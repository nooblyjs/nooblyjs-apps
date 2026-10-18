'use strict';

const {
  VIEW_BASE_PATH,
  MEDIA_BASE_PATH,
  PUBLIC_BASE_PATH,
  FONTS,
  escapeHtml
} = require('../routes/shared/helpers');

const BOOTSTRAP_CSS = 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css';
const BOOTSTRAP_JS = 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js';
const SITE_CSS = `${VIEW_BASE_PATH}/assets/css/site.css`;

/**
 * Content-Security-Policy for rendered sites. Page HTML is sanitised on save; this is the second line of defence.
 */
const SITE_CSP = [
  "default-src 'self'",
  "script-src 'self' https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net",
  "img-src 'self' https: data:",
  'frame-src https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com',
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'self'"
].join('; ');

const publicPageUrl = (site, page) => (
  page.id === site.homePageId
    ? `${PUBLIC_BASE_PATH}/${site.slug}/`
    : `${PUBLIC_BASE_PATH}/${site.slug}/${page.slug}`
);

const previewPageUrl = (site, page) => `${VIEW_BASE_PATH}/preview/${site.id}/${page.id}`;

/**
 * Builds the navbar items. Live sites show published pages; previews show every page with its draft title.
 */
function buildNav(site, pages, currentPageId, preview) {
  const visible = pages.filter((p) => p.showInNav && (preview || p.published));
  const titleOf = (p) => (preview || !p.published ? p.title : p.published.title);
  const linkOf = (p) => (preview ? previewPageUrl(site, p) : publicPageUrl(site, p));

  return visible
    .filter((p) => !p.parentPageId || !visible.some((parent) => parent.id === p.parentPageId))
    .map((p) => {
      const children = visible.filter((c) => c.parentPageId === p.id);
      const active = p.id === currentPageId || children.some((c) => c.id === currentPageId);
      if (!children.length) {
        return `<li class="nav-item"><a class="nav-link${active ? ' active' : ''}" href="${escapeHtml(linkOf(p))}"${active ? ' aria-current="page"' : ''}>${escapeHtml(titleOf(p))}</a></li>`;
      }
      const items = [p, ...children].map((c) => (
        `<li><a class="dropdown-item${c.id === currentPageId ? ' active' : ''}" href="${escapeHtml(linkOf(c))}">${escapeHtml(titleOf(c))}</a></li>`
      )).join('');
      return `<li class="nav-item dropdown"><a class="nav-link dropdown-toggle${active ? ' active' : ''}" href="#" role="button" data-bs-toggle="dropdown" aria-expanded="false">${escapeHtml(titleOf(p))}</a><ul class="dropdown-menu">${items}</ul></li>`;
    })
    .join('');
}

function fontLink(settings) {
  const families = [...new Set([settings.headingFont, settings.bodyFont])]
    .map((id) => FONTS[id] && FONTS[id].google)
    .filter(Boolean);
  if (!families.length) return '';
  return `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?${families.map((f) => `family=${f}`).join('&')}&display=swap">`;
}

/**
 * Renders a full HTML page for a site.
 *
 * @param {Object} params
 * @param {Object} params.site Site record (settings already merged with defaults)
 * @param {Array<Object>} params.pages All pages of the site, sorted
 * @param {Object} params.page The page being shown
 * @param {{title: string, content: string, seo: Object}} params.version The copy to render (live or draft)
 * @param {string} params.origin e.g. https://example.com, for absolute Open Graph URLs
 * @param {boolean} params.preview True for draft previews
 * @return {string} HTML
 */
function renderPage({ site, pages, page, version, origin, preview = false }) {
  const s = site.settings;
  const headingFont = (FONTS[s.headingFont] || FONTS.system).family;
  const bodyFont = (FONTS[s.bodyFont] || FONTS.system).family;
  const seo = version.seo || {};
  const docTitle = seo.title || (page.id === site.homePageId ? site.name : `${version.title} · ${site.name}`);
  const description = seo.description || site.description || '';
  const ogImage = seo.ogImageMediaId ? `${origin}${MEDIA_BASE_PATH}/${seo.ogImageMediaId}` : '';
  const homeLink = preview && site.homePageId
    ? `${VIEW_BASE_PATH}/preview/${site.id}/${site.homePageId}`
    : `${PUBLIC_BASE_PATH}/${site.slug}/`;
  const brand = s.logoMediaId
    ? `<img src="${MEDIA_BASE_PATH}/${escapeHtml(s.logoMediaId)}" alt="${escapeHtml(site.name)}" class="site-logo">`
    : escapeHtml(site.name);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(docTitle)}</title>
${description ? `<meta name="description" content="${escapeHtml(description)}">` : ''}
<meta property="og:title" content="${escapeHtml(seo.title || version.title)}">
<meta property="og:site_name" content="${escapeHtml(site.name)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${escapeHtml(origin + publicPageUrl(site, page))}">
${description ? `<meta property="og:description" content="${escapeHtml(description)}">` : ''}
${ogImage ? `<meta property="og:image" content="${escapeHtml(ogImage)}">` : ''}
${preview ? '<meta name="robots" content="noindex">' : ''}
<link rel="stylesheet" href="${BOOTSTRAP_CSS}">
${fontLink(s)}
<link rel="stylesheet" href="${SITE_CSS}">
<style>:root { --site-primary: ${s.primaryColor}; --site-bg: ${s.backgroundColor}; --site-text: ${s.textColor}; --site-heading-font: ${headingFont}; --site-body-font: ${bodyFont}; }</style>
</head>
<body>
${preview ? `<div class="preview-banner">Preview of the draft. Visitors ${page.published ? 'see the last published version' : 'cannot see this page yet'}.</div>` : ''}
<nav class="navbar navbar-expand-md site-navbar">
  <div class="container">
    <a class="navbar-brand" href="${escapeHtml(homeLink)}">${brand}</a>
    <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#siteNav" aria-controls="siteNav" aria-expanded="false" aria-label="Toggle navigation"><span class="navbar-toggler-icon"></span></button>
    <div class="collapse navbar-collapse" id="siteNav"><ul class="navbar-nav ms-auto">${buildNav(site, pages, page.id, preview)}</ul></div>
  </div>
</nav>
<main class="container site-content">
${version.content || ''}
</main>
<footer class="site-footer">
  <div class="container">
    ${s.footerText ? `<p>${escapeHtml(s.footerText)}</p>` : ''}
    <p class="small mb-0">&copy; ${new Date().getFullYear()} ${escapeHtml(site.name)}</p>
  </div>
</footer>
<script src="${BOOTSTRAP_JS}"></script>
</body>
</html>`;
}

/**
 * Renders a plain not-found page for public URLs.
 */
function renderNotFound() {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Page not found</title>
<link rel="stylesheet" href="${BOOTSTRAP_CSS}"></head>
<body class="d-flex align-items-center justify-content-center" style="min-height: 100vh;">
<div class="text-center"><h1 class="display-5">Page not found</h1><p class="text-muted">This page doesn't exist or isn't published.</p></div>
</body>
</html>`;
}

/**
 * Renders sitemap.xml for the published pages of a site.
 */
function renderSitemap({ site, pages, origin }) {
  const urls = pages
    .filter((p) => p.published)
    .map((p) => `  <url><loc>${escapeHtml(origin + publicPageUrl(site, p))}</loc><lastmod>${p.published.publishedAt.slice(0, 10)}</lastmod></url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}

module.exports = { renderPage, renderNotFound, renderSitemap, publicPageUrl, SITE_CSP };
