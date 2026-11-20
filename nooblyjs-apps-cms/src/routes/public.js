'use strict';

const {
  VIEW_BASE_PATH,
  PUBLIC_BASE_PATH,
  DEFAULT_SITE_SETTINGS,
  route
} = require('./shared/helpers');
const { renderPage, renderNotFound, renderSitemap, SITE_CSP } = require('../services/renderer');

/**
 * Registers the public site routes and the signed-in draft preview.
 *
 * @param {Object} app Express app
 * @param {Object} ctx Shared context: store, log, requireUser, views
 */
module.exports = (app, ctx) => {
  const { store, log, requireUser, views } = ctx;

  const originOf = (req) => `${req.protocol}://${req.get('host')}`;

  const sendHtml = (res, status, html) => {
    res.status(status).set({
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': SITE_CSP,
      'X-Content-Type-Options': 'nosniff'
    }).send(html);
  };

  const notFoundPage = (res) => sendHtml(res, 404, renderNotFound());

  const loadOnlineSite = async (slug) => {
    const site = await store.findSiteBySlug(String(slug).toLowerCase());
    if (!site || !site.online) return null;
    site.settings = { ...DEFAULT_SITE_SETTINGS, ...(site.settings || {}) };
    return site;
  };

  const showPublished = async (req, res, site, page, pages) => {
    if (!page || !page.published) return notFoundPage(res);
    views.record(site.id, page.id);
    sendHtml(res, 200, renderPage({ site, pages, page, version: page.published, origin: originOf(req) }));
  };

  // The home page lives at /sites/:slug/. Express ignores trailing slashes when matching,
  // so redirect the slash-less form here; otherwise relative links would break.
  app.get(`${PUBLIC_BASE_PATH}/:siteSlug`, route(log, async (req, res) => {
    if (!req.path.endsWith('/')) {
      return res.redirect(301, `${PUBLIC_BASE_PATH}/${encodeURIComponent(req.params.siteSlug)}/`);
    }
    const site = await loadOnlineSite(req.params.siteSlug);
    if (!site) return notFoundPage(res);
    const pages = await store.listPages(site.id);
    return showPublished(req, res, site, pages.find((p) => p.id === site.homePageId), pages);
  }));

  app.get(`${PUBLIC_BASE_PATH}/:siteSlug/sitemap.xml`, route(log, async (req, res) => {
    const site = await loadOnlineSite(req.params.siteSlug);
    if (!site) return notFoundPage(res);
    const pages = await store.listPages(site.id);
    res.type('application/xml').send(renderSitemap({ site, pages, origin: originOf(req) }));
  }));

  app.get(`${PUBLIC_BASE_PATH}/:siteSlug/:pageSlug`, route(log, async (req, res) => {
    const site = await loadOnlineSite(req.params.siteSlug);
    if (!site) return notFoundPage(res);
    const pages = await store.listPages(site.id);
    const page = pages.find((p) => p.slug === req.params.pageSlug);
    // The home page lives at the site root.
    if (page && page.id === site.homePageId) {
      return res.redirect(301, `${PUBLIC_BASE_PATH}/${site.slug}/`);
    }
    return showPublished(req, res, site, page, pages);
  }));

  app.get(`${VIEW_BASE_PATH}/preview/:siteId/:pageId`, requireUser, route(log, async (req, res) => {
    let site;
    let page;
    try {
      ({ site } = await store.requireSite(req.params.siteId, req.cmsUser));
      page = await store.requirePage(site, req.params.pageId);
    } catch (error) {
      return notFoundPage(res);
    }
    const pages = await store.listPages(site.id);
    const html = renderPage({ site, pages, page, version: page, origin: originOf(req), preview: true });
    res.set('Cache-Control', 'no-store');
    return sendHtml(res, 200, html);
  }));
};
