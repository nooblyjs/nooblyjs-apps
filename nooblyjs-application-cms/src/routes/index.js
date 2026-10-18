'use strict';

const { buildLogger, createRequireUser } = require('./shared/helpers');
const { CmsStore } = require('./shared/store');
const { PageViews } = require('../services/pageViews');

const registerDocumentationRoutes = require('./documentation');
const registerSitesRoutes = require('./sites');
const registerPagesRoutes = require('./pages');
const registerMediaRoutes = require('./media');
const registerPublicRoutes = require('./public');

// Scheduled publishing and view-count flushing run on this interval (the tests shorten it).
const BACKGROUND_INTERVAL_MS = Number(process.env.CMS_BACKGROUND_INTERVAL_MS) || 60 * 1000;

/**
 * Configures and registers CMS API and public routes with the Express application.
 *
 * @param {Object} options Express binding and paths: { app, docsDir }
 * @param {import('events').EventEmitter} eventEmitter
 * @param {Object} services NooblyJS services
 * @return {{ stop: Function }} Stops the background timers and flushes view counts
 */
module.exports = (options, eventEmitter, services) => {
  const app = options.app;
  const { dataService, filing, logger, measuring, authService } = services;

  if (!app) throw new Error('CMS routes require an Express application instance.');
  if (!dataService) throw new Error('CMS routes require the NooblyJS dataService.');
  if (!filing) throw new Error('CMS routes require the NooblyJS filing service.');
  if (!authService) throw new Error('CMS routes require the NooblyJS auth service.');

  const log = buildLogger(logger);
  const store = new CmsStore(dataService);
  const views = new PageViews(store, measuring, log);

  const ctx = {
    store,
    log,
    filing,
    views,
    docsDir: options.docsDir,
    requireUser: createRequireUser(authService)
  };

  registerDocumentationRoutes(app, ctx);
  registerSitesRoutes(app, ctx);
  registerPagesRoutes(app, ctx);
  registerMediaRoutes(app, ctx);
  registerPublicRoutes(app, ctx);

  const runBackgroundWork = async () => {
    try {
      await ctx.publishDuePages();
      await views.flush();
    } catch (error) {
      log.error(`CMS background work failed: ${error.message}`);
    }
  };
  const timer = setInterval(runBackgroundWork, BACKGROUND_INTERVAL_MS);
  timer.unref();

  log.info('CMS routes registered');

  return {
    runBackgroundWork,
    stop: async () => {
      clearInterval(timer);
      await views.flush();
    }
  };
};
