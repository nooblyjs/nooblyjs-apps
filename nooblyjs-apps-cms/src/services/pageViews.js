'use strict';

const { CONTAINERS } = require('../routes/shared/helpers');

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Counts public page views. Counts are buffered in memory and written to the
 * dataService once a minute, so a busy page doesn't rewrite the container on every hit.
 * Each view is also reported to the NooblyJS measuring service for its dashboard.
 */
class PageViews {
  /**
   * @param {import('../routes/shared/store').CmsStore} store
   * @param {Object} measuring NooblyJS measuring service
   * @param {Object} log Logger
   */
  constructor(store, measuring, log) {
    this.store = store;
    this.measuring = measuring;
    this.log = log;
    this.pending = new Map(); // `${siteId}|${day}` -> { pageId: count }
  }

  record(siteId, pageId) {
    const key = `${siteId}|${today()}`;
    const counts = this.pending.get(key) || {};
    counts[pageId] = (counts[pageId] || 0) + 1;
    this.pending.set(key, counts);
    try {
      if (this.measuring) this.measuring.add('cms.pageViews', 1);
    } catch (error) {
      // Metrics are best-effort.
    }
  }

  async flush() {
    if (!this.pending.size) return;
    const batch = this.pending;
    this.pending = new Map();
    for (const [key, counts] of batch) {
      const [siteId, day] = key.split('|');
      const [existing] = await this.store.list(CONTAINERS.PAGE_VIEWS, (r) => r.siteId === siteId && r.day === day);
      if (existing) {
        Object.entries(counts).forEach(([pageId, n]) => {
          existing.views[pageId] = (existing.views[pageId] || 0) + n;
        });
        await this.store.save(CONTAINERS.PAGE_VIEWS, existing);
      } else {
        await this.store.insert(CONTAINERS.PAGE_VIEWS, { siteId, day, views: counts });
      }
    }
  }

  /**
   * Total views for a site over the last `days` days, including unflushed counts.
   */
  async totalForSite(siteId, days) {
    const since = new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const sum = (views) => Object.values(views).reduce((a, b) => a + b, 0);
    const stored = await this.store.list(CONTAINERS.PAGE_VIEWS, (r) => r.siteId === siteId && r.day >= since);
    let total = stored.reduce((acc, r) => acc + sum(r.views), 0);
    for (const [key, counts] of this.pending) {
      const [pendingSite, day] = key.split('|');
      if (pendingSite === siteId && day >= since) total += sum(counts);
    }
    return total;
  }

  async removeSite(siteId) {
    for (const key of [...this.pending.keys()]) {
      if (key.startsWith(`${siteId}|`)) this.pending.delete(key);
    }
    for (const record of await this.store.list(CONTAINERS.PAGE_VIEWS, (r) => r.siteId === siteId)) {
      await this.store.remove(CONTAINERS.PAGE_VIEWS, record.id);
    }
  }
}

module.exports = { PageViews };
