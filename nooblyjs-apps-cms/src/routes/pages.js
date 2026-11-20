'use strict';

const {
  API_BASE_PATH,
  CONTAINERS,
  route,
  badRequest,
  conflict,
  notFound,
  requireText,
  optionalText,
  cleanSlug,
  sanitizeContent
} = require('./shared/helpers');
const { CmsStore } = require('./shared/store');

/**
 * Registers page routes: drafts, hierarchy, publishing and version history.
 *
 * @param {Object} app Express app
 * @param {Object} ctx Shared context: store, log, requireUser
 */
module.exports = (app, ctx) => {
  const { store, log, requireUser } = ctx;
  const SITE_PAGES = `${API_BASE_PATH}/sites/:siteId/pages`;
  const PAGE = `${SITE_PAGES}/:pageId`;

  const withStatus = (page) => ({ ...page, status: CmsStore.pageStatus(page) });

  const ensureSlugFree = (pages, slug, pageId) => {
    if (pages.some((p) => p.slug === slug && p.id !== pageId)) {
      throw conflict(`Another page on this site already uses the slug "${slug}".`);
    }
  };

  // Pick a free slug by adding -2, -3... when the slug was derived from the title.
  const freeSlug = (pages, base) => {
    let slug = base;
    for (let n = 2; pages.some((p) => p.slug === slug); n += 1) slug = `${base}-${n}`;
    return slug;
  };

  // Only one level of nesting: a parent must be a top-level page and a page with children stays top-level.
  const checkParent = (pages, parentPageId, pageId) => {
    if (parentPageId === null || parentPageId === undefined || parentPageId === '') return null;
    const parent = pages.find((p) => p.id === parentPageId);
    if (!parent) throw badRequest('The parent page does not exist on this site.');
    if (parent.id === pageId) throw badRequest('A page cannot be its own parent.');
    if (parent.parentPageId) throw badRequest('Pages can only be nested one level deep.');
    if (pageId && pages.some((p) => p.parentPageId === pageId)) {
      throw badRequest('This page has child pages, so it must stay at the top level.');
    }
    return parent.id;
  };

  const cleanSeo = async (site, input = {}, current = {}) => {
    if (typeof input !== 'object' || input === null) throw badRequest('SEO must be an object.');
    const seo = { title: '', description: '', ogImageMediaId: null, ...current };
    if (input.title !== undefined) seo.title = optionalText(input.title, 'SEO title', 120);
    if (input.description !== undefined) seo.description = optionalText(input.description, 'SEO description', 300);
    if (input.ogImageMediaId !== undefined) {
      seo.ogImageMediaId = input.ogImageMediaId || null;
      if (seo.ogImageMediaId) {
        const media = await store.get(CONTAINERS.MEDIA, String(seo.ogImageMediaId));
        if (!media || media.siteId !== site.id || !media.mimeType.startsWith('image/')) {
          throw badRequest('The social image must be an image from this site\'s media library.');
        }
      }
    }
    return seo;
  };

  const cleanSchedule = (value) => {
    if (value === null || value === '') return null;
    const when = new Date(value);
    if (typeof value !== 'string' || Number.isNaN(when.getTime())) {
      throw badRequest('scheduledAt must be a date and time.');
    }
    if (when.getTime() < Date.now() - 60 * 1000) {
      throw badRequest('The scheduled time is in the past.');
    }
    return when.toISOString();
  };

  app.get(SITE_PAGES, requireUser, route(log, async (req, res) => {
    const { site } = await store.requireSite(req.params.siteId, req.cmsUser);
    const pages = await store.listPages(site.id);
    res.json({ pages: pages.map(CmsStore.pageSummary), homePageId: site.homePageId });
  }));

  app.post(SITE_PAGES, requireUser, route(log, async (req, res) => {
    const { site } = await store.requireSite(req.params.siteId, req.cmsUser);
    const pages = await store.listPages(site.id);
    const title = requireText(req.body.title, 'Title', 150);

    let slug;
    if (req.body.slug) {
      slug = cleanSlug(req.body.slug);
      ensureSlugFree(pages, slug);
    } else {
      slug = freeSlug(pages, cleanSlug('', title));
    }

    const now = new Date().toISOString();
    const page = await store.insert(CONTAINERS.PAGES, {
      siteId: site.id,
      title,
      slug,
      parentPageId: checkParent(pages, req.body.parentPageId),
      order: pages.reduce((max, p) => Math.max(max, p.order), -1) + 1,
      showInNav: true,
      content: '',
      seo: { title: '', description: '', ogImageMediaId: null },
      published: null,
      scheduledAt: null,
      createdAt: now,
      updatedAt: now,
      updatedBy: req.cmsUser.email
    });
    res.status(201).json({ page: withStatus(page) });
  }));

  app.put(`${SITE_PAGES}/order`, requireUser, route(log, async (req, res) => {
    const { site } = await store.requireSite(req.params.siteId, req.cmsUser);
    const pages = await store.listPages(site.id);
    const ids = req.body.pageIds;
    if (!Array.isArray(ids) || ids.length !== pages.length
      || new Set(ids).size !== ids.length || !ids.every((id) => pages.some((p) => p.id === id))) {
      throw badRequest('pageIds must list every page on the site exactly once.');
    }
    for (const [index, id] of ids.entries()) {
      const page = pages.find((p) => p.id === id);
      if (page.order !== index) {
        page.order = index;
        await store.save(CONTAINERS.PAGES, page);
      }
    }
    const sorted = await store.listPages(site.id);
    res.json({ pages: sorted.map(CmsStore.pageSummary), homePageId: site.homePageId });
  }));

  app.get(PAGE, requireUser, route(log, async (req, res) => {
    const { site } = await store.requireSite(req.params.siteId, req.cmsUser);
    const page = await store.requirePage(site, req.params.pageId);
    res.json({ page: withStatus(page), isHome: site.homePageId === page.id });
  }));

  app.put(PAGE, requireUser, route(log, async (req, res) => {
    const { site } = await store.requireSite(req.params.siteId, req.cmsUser);
    const page = await store.requirePage(site, req.params.pageId);
    const pages = await store.listPages(site.id);
    const body = req.body || {};

    if (body.title !== undefined) page.title = requireText(body.title, 'Title', 150);
    if (body.slug !== undefined) {
      const slug = cleanSlug(body.slug);
      ensureSlugFree(pages, slug, page.id);
      page.slug = slug;
    }
    if (body.parentPageId !== undefined) page.parentPageId = checkParent(pages, body.parentPageId, page.id);
    if (body.showInNav !== undefined) page.showInNav = Boolean(body.showInNav);
    if (body.content !== undefined) page.content = sanitizeContent(body.content);
    if (body.seo !== undefined) page.seo = await cleanSeo(site, body.seo, page.seo);
    if (body.scheduledAt !== undefined) page.scheduledAt = cleanSchedule(body.scheduledAt);

    page.updatedAt = new Date().toISOString();
    page.updatedBy = req.cmsUser.email;
    await store.save(CONTAINERS.PAGES, page);
    await store.addVersion(page, body.autosave ? 'autosave' : 'save', req.cmsUser.email);
    res.json({ page: withStatus(page), isHome: site.homePageId === page.id });
  }));

  app.delete(PAGE, requireUser, route(log, async (req, res) => {
    const { site } = await store.requireSite(req.params.siteId, req.cmsUser);
    const page = await store.requirePage(site, req.params.pageId);
    if (site.homePageId === page.id) {
      throw badRequest('This is the home page. Make another page the home page first.');
    }
    for (const child of await store.list(CONTAINERS.PAGES, (p) => p.parentPageId === page.id)) {
      child.parentPageId = null;
      await store.save(CONTAINERS.PAGES, child);
    }
    for (const version of await store.listVersions(page.id)) {
      await store.remove(CONTAINERS.VERSIONS, version.id);
    }
    await store.remove(CONTAINERS.PAGES, page.id);
    res.status(204).end();
  }));

  app.post(`${PAGE}/home`, requireUser, route(log, async (req, res) => {
    const { site } = await store.requireSite(req.params.siteId, req.cmsUser, 'owner');
    const page = await store.requirePage(site, req.params.pageId);
    site.homePageId = page.id;
    site.updatedAt = new Date().toISOString();
    await store.save(CONTAINERS.SITES, site);
    res.json({ homePageId: site.homePageId });
  }));

  app.post(`${PAGE}/publish`, requireUser, route(log, async (req, res) => {
    const { site } = await store.requireSite(req.params.siteId, req.cmsUser);
    const page = await store.requirePage(site, req.params.pageId);
    await store.publishPage(page, req.cmsUser.email);
    log.info(`CMS page published: ${site.slug}/${page.slug} by ${req.cmsUser.email}`);
    res.json({ page: withStatus(page), isHome: site.homePageId === page.id });
  }));

  app.post(`${PAGE}/unpublish`, requireUser, route(log, async (req, res) => {
    const { site } = await store.requireSite(req.params.siteId, req.cmsUser);
    const page = await store.requirePage(site, req.params.pageId);
    page.published = null;
    page.scheduledAt = null;
    page.updatedAt = new Date().toISOString();
    page.updatedBy = req.cmsUser.email;
    await store.save(CONTAINERS.PAGES, page);
    res.json({ page: withStatus(page), isHome: site.homePageId === page.id });
  }));

  app.get(`${PAGE}/versions`, requireUser, route(log, async (req, res) => {
    const { site } = await store.requireSite(req.params.siteId, req.cmsUser);
    const page = await store.requirePage(site, req.params.pageId);
    const versions = await store.listVersions(page.id);
    res.json({ versions: versions.map(({ content, ...rest }) => rest) });
  }));

  const requireVersion = async (page, versionId) => {
    const version = await store.get(CONTAINERS.VERSIONS, versionId);
    if (!version || version.pageId !== page.id) throw notFound('Version not found.');
    return version;
  };

  app.get(`${PAGE}/versions/:versionId`, requireUser, route(log, async (req, res) => {
    const { site } = await store.requireSite(req.params.siteId, req.cmsUser);
    const page = await store.requirePage(site, req.params.pageId);
    res.json({ version: await requireVersion(page, req.params.versionId) });
  }));

  app.post(`${PAGE}/versions/:versionId/restore`, requireUser, route(log, async (req, res) => {
    const { site } = await store.requireSite(req.params.siteId, req.cmsUser);
    const page = await store.requirePage(site, req.params.pageId);
    const version = await requireVersion(page, req.params.versionId);
    page.title = version.title;
    page.content = version.content;
    page.seo = { ...version.seo };
    page.updatedAt = new Date().toISOString();
    page.updatedBy = req.cmsUser.email;
    await store.save(CONTAINERS.PAGES, page);
    await store.addVersion(page, 'restore', req.cmsUser.email);
    res.json({ page: withStatus(page), isHome: site.homePageId === page.id });
  }));

  // Exposed for the scheduler: publishes every page whose scheduled time has passed.
  ctx.publishDuePages = async () => {
    const now = new Date().toISOString();
    const due = await store.list(CONTAINERS.PAGES, (p) => p.scheduledAt && p.scheduledAt <= now);
    for (const page of due) {
      await store.publishPage(page, page.updatedBy || 'scheduler');
      log.info(`CMS scheduled page published: ${page.id}`);
    }
    return due.length;
  };
};
