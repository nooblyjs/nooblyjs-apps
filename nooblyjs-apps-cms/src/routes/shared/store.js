'use strict';

const {
  CONTAINERS,
  MAX_VERSIONS_PER_PAGE,
  DEFAULT_SITE_SETTINGS,
  forbidden,
  notFound
} = require('./helpers');

/**
 * Data access for the CMS on top of the NooblyJS dataService.
 * The dataService generates each record's key on add; we copy it into the record as `id`
 * so listAll() results can be addressed later.
 */
class CmsStore {
  /**
   * @param {Object} dataService NooblyJS dataService (file provider)
   */
  constructor(dataService) {
    this.data = dataService;
  }

  async insert(container, record) {
    const id = await this.data.add(container, record);
    const stored = { ...record, id };
    await this.data.update(container, id, stored);
    return stored;
  }

  async get(container, id) {
    if (!id || typeof id !== 'string') return null;
    return this.data.getByUuid(container, id);
  }

  async save(container, record) {
    await this.data.update(container, record.id, record);
    return record;
  }

  async remove(container, id) {
    return this.data.remove(container, id);
  }

  async list(container, predicate = () => true) {
    return this.data.jsonFind(container, predicate);
  }

  // Sites -----------------------------------------------------------------

  async listSitesFor(user) {
    const sites = await this.list(CONTAINERS.SITES);
    return sites.filter((site) => user.isAdmin || this.roleFor(site, user));
  }

  async findSiteBySlug(slug) {
    const [site] = await this.list(CONTAINERS.SITES, (s) => s.slug === slug);
    return site || null;
  }

  /**
   * Returns 'owner', 'editor' or null for the user on this site. Admins are treated as owners.
   */
  roleFor(site, user) {
    if (user.isAdmin || site.ownerEmail === user.email) return 'owner';
    const member = (site.members || []).find((m) => m.email === user.email);
    return member ? member.role : null;
  }

  /**
   * Loads a site and checks the user has at least the given role on it.
   * @param {string} siteId
   * @param {Object} user req.cmsUser
   * @param {'editor'|'owner'} minimumRole
   * @return {Promise<{site: Object, role: string}>}
   */
  async requireSite(siteId, user, minimumRole = 'editor') {
    const site = await this.get(CONTAINERS.SITES, siteId);
    if (!site) throw notFound('Site not found.');
    const role = this.roleFor(site, user);
    if (!role) throw notFound('Site not found.');
    if (minimumRole === 'owner' && role !== 'owner') {
      throw forbidden('Only the site owner can do that.');
    }
    site.settings = { ...DEFAULT_SITE_SETTINGS, ...(site.settings || {}) };
    return { site, role };
  }

  // Pages -----------------------------------------------------------------

  async listPages(siteId) {
    const pages = await this.list(CONTAINERS.PAGES, (p) => p.siteId === siteId);
    return pages.sort((a, b) => (a.order - b.order) || a.createdAt.localeCompare(b.createdAt));
  }

  async requirePage(site, pageId) {
    const page = await this.get(CONTAINERS.PAGES, pageId);
    if (!page || page.siteId !== site.id) throw notFound('Page not found.');
    return page;
  }

  /**
   * Derives a page's status from its draft, published copy and schedule.
   */
  static pageStatus(page) {
    if (page.scheduledAt) return 'scheduled';
    if (!page.published) return 'draft';
    const p = page.published;
    const same = p.title === page.title && p.content === page.content
      && JSON.stringify(p.seo || {}) === JSON.stringify(page.seo || {});
    return same ? 'published' : 'changed';
  }

  /**
   * Strips content for list responses and adds the derived status.
   */
  static pageSummary(page) {
    const { content, published, ...rest } = page;
    return {
      ...rest,
      status: CmsStore.pageStatus(page),
      publishedAt: published ? published.publishedAt : null
    };
  }

  /**
   * Copies the draft to the live copy.
   */
  async publishPage(page, email) {
    page.published = {
      title: page.title,
      content: page.content,
      seo: { ...page.seo },
      publishedAt: new Date().toISOString(),
      publishedBy: email
    };
    page.scheduledAt = null;
    await this.save(CONTAINERS.PAGES, page);
    await this.addVersion(page, 'publish', email);
    return page;
  }

  // Versions --------------------------------------------------------------

  async listVersions(pageId) {
    const versions = await this.list(CONTAINERS.VERSIONS, (v) => v.pageId === pageId);
    return versions.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  }

  /**
   * Records a version when the page differs from its newest version, then prunes old ones.
   * Publishing always records a version so the history shows what went live.
   */
  async addVersion(page, reason, email) {
    const versions = await this.listVersions(page.id);
    const latest = versions[0];
    const unchanged = latest && latest.title === page.title && latest.content === page.content
      && JSON.stringify(latest.seo || {}) === JSON.stringify(page.seo || {});
    if (unchanged && reason !== 'publish') return null;

    const version = await this.insert(CONTAINERS.VERSIONS, {
      pageId: page.id,
      siteId: page.siteId,
      title: page.title,
      content: page.content,
      seo: { ...page.seo },
      reason,
      savedAt: new Date().toISOString(),
      savedBy: email
    });
    const stale = versions.slice(MAX_VERSIONS_PER_PAGE - 1);
    for (const old of stale) {
      await this.remove(CONTAINERS.VERSIONS, old.id);
    }
    return version;
  }
}

module.exports = { CmsStore };
