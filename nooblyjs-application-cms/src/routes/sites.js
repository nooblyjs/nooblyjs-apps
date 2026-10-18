'use strict';

const {
  API_BASE_PATH,
  CONTAINERS,
  DEFAULT_SITE_SETTINGS,
  FONTS,
  route,
  badRequest,
  conflict,
  notFound,
  requireText,
  optionalText,
  cleanSlug,
  cleanSiteSettings
} = require('./shared/helpers');

const STARTER_CONTENT = '<h1>Welcome</h1><p>This is your new site. Edit this page to get started.</p>';

/**
 * Registers site management routes.
 *
 * @param {Object} app Express app
 * @param {Object} ctx Shared context: store, log, requireUser, views, deleteMediaFile
 */
module.exports = (app, ctx) => {
  const { store, log, requireUser, views } = ctx;

  const ensureSlugFree = async (slug, siteId) => {
    const existing = await store.findSiteBySlug(slug);
    if (existing && existing.id !== siteId) {
      throw conflict(`Another site already uses the slug "${slug}".`);
    }
  };

  app.get(`${API_BASE_PATH}/me`, requireUser, (req, res) => {
    res.json({ user: req.cmsUser, fonts: Object.entries(FONTS).map(([id, f]) => ({ id, label: f.label })) });
  });

  app.get(`${API_BASE_PATH}/sites`, requireUser, route(log, async (req, res) => {
    const sites = await store.listSitesFor(req.cmsUser);
    const pages = await store.list(CONTAINERS.PAGES);
    const result = sites
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((site) => ({
        ...site,
        role: store.roleFor(site, req.cmsUser),
        pageCount: pages.filter((p) => p.siteId === site.id).length
      }));
    for (const site of result) {
      site.viewsLast7Days = await views.totalForSite(site.id, 7);
    }
    res.json({ sites: result });
  }));

  app.post(`${API_BASE_PATH}/sites`, requireUser, route(log, async (req, res) => {
    const name = requireText(req.body.name, 'Name', 120);
    const slug = cleanSlug(req.body.slug, name);
    await ensureSlugFree(slug);

    const now = new Date().toISOString();
    const site = await store.insert(CONTAINERS.SITES, {
      name,
      slug,
      description: optionalText(req.body.description, 'Description', 500),
      ownerEmail: req.cmsUser.email,
      members: [],
      online: false,
      homePageId: null,
      settings: { ...DEFAULT_SITE_SETTINGS },
      createdAt: now,
      updatedAt: now
    });

    const home = await store.insert(CONTAINERS.PAGES, {
      siteId: site.id,
      title: 'Home',
      slug: 'home',
      parentPageId: null,
      order: 0,
      showInNav: true,
      content: STARTER_CONTENT,
      seo: { title: '', description: '', ogImageMediaId: null },
      published: null,
      scheduledAt: null,
      createdAt: now,
      updatedAt: now,
      updatedBy: req.cmsUser.email
    });
    site.homePageId = home.id;
    await store.save(CONTAINERS.SITES, site);

    log.info(`CMS site created: ${site.slug} by ${req.cmsUser.email}`);
    res.status(201).json({ site: { ...site, role: 'owner' } });
  }));

  app.get(`${API_BASE_PATH}/sites/:siteId`, requireUser, route(log, async (req, res) => {
    const { site, role } = await store.requireSite(req.params.siteId, req.cmsUser);
    res.json({ site: { ...site, role } });
  }));

  app.put(`${API_BASE_PATH}/sites/:siteId`, requireUser, route(log, async (req, res) => {
    const { site } = await store.requireSite(req.params.siteId, req.cmsUser, 'owner');
    const body = req.body || {};

    if (body.name !== undefined) site.name = requireText(body.name, 'Name', 120);
    if (body.slug !== undefined) {
      const slug = cleanSlug(body.slug);
      await ensureSlugFree(slug, site.id);
      site.slug = slug;
    }
    if (body.description !== undefined) site.description = optionalText(body.description, 'Description', 500);
    if (body.settings !== undefined) {
      if (typeof body.settings !== 'object' || body.settings === null) throw badRequest('Settings must be an object.');
      site.settings = cleanSiteSettings(body.settings, site.settings);
      if (site.settings.logoMediaId) {
        const media = await store.get(CONTAINERS.MEDIA, site.settings.logoMediaId);
        if (!media || media.siteId !== site.id || !media.mimeType.startsWith('image/')) {
          throw badRequest('The logo must be an image from this site\'s media library.');
        }
      }
    }
    site.updatedAt = new Date().toISOString();
    await store.save(CONTAINERS.SITES, site);
    res.json({ site: { ...site, role: 'owner' } });
  }));

  app.post(`${API_BASE_PATH}/sites/:siteId/online`, requireUser, route(log, async (req, res) => {
    const { site } = await store.requireSite(req.params.siteId, req.cmsUser, 'owner');
    if (typeof req.body.online !== 'boolean') throw badRequest('online must be true or false.');
    site.online = req.body.online;
    site.updatedAt = new Date().toISOString();
    await store.save(CONTAINERS.SITES, site);
    log.info(`CMS site ${site.slug} is now ${site.online ? 'online' : 'offline'}`);
    res.json({ site: { ...site, role: 'owner' } });
  }));

  app.delete(`${API_BASE_PATH}/sites/:siteId`, requireUser, route(log, async (req, res) => {
    const { site } = await store.requireSite(req.params.siteId, req.cmsUser, 'owner');
    for (const page of await store.list(CONTAINERS.PAGES, (p) => p.siteId === site.id)) {
      await store.remove(CONTAINERS.PAGES, page.id);
    }
    for (const version of await store.list(CONTAINERS.VERSIONS, (v) => v.siteId === site.id)) {
      await store.remove(CONTAINERS.VERSIONS, version.id);
    }
    for (const media of await store.list(CONTAINERS.MEDIA, (m) => m.siteId === site.id)) {
      await ctx.deleteMediaFile(media);
      await store.remove(CONTAINERS.MEDIA, media.id);
    }
    await views.removeSite(site.id);
    await store.remove(CONTAINERS.SITES, site.id);
    log.info(`CMS site deleted: ${site.slug} by ${req.cmsUser.email}`);
    res.status(204).end();
  }));

  app.post(`${API_BASE_PATH}/sites/:siteId/members`, requireUser, route(log, async (req, res) => {
    const { site } = await store.requireSite(req.params.siteId, req.cmsUser, 'owner');
    const email = requireText(req.body.email, 'Email', 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+$/.test(email)) throw badRequest('Enter a valid email address.');
    if (email === site.ownerEmail) throw badRequest('The owner already has full access.');
    site.members = site.members || [];
    if (!site.members.some((m) => m.email === email)) {
      site.members.push({ email, role: 'editor' });
      site.updatedAt = new Date().toISOString();
      await store.save(CONTAINERS.SITES, site);
    }
    res.status(201).json({ site: { ...site, role: 'owner' } });
  }));

  app.delete(`${API_BASE_PATH}/sites/:siteId/members/:email`, requireUser, route(log, async (req, res) => {
    const { site } = await store.requireSite(req.params.siteId, req.cmsUser, 'owner');
    const email = String(req.params.email).toLowerCase();
    const before = (site.members || []).length;
    site.members = (site.members || []).filter((m) => m.email !== email);
    if (site.members.length === before) throw notFound('That person is not a member of this site.');
    site.updatedAt = new Date().toISOString();
    await store.save(CONTAINERS.SITES, site);
    res.json({ site: { ...site, role: 'owner' } });
  }));
};
