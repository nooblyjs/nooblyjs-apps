/**
 * @fileoverview Wiki API routes for Express.js application.
 * Provides RESTful endpoints for structured wiki operations
 *
 * @author noobly Team
 * @version 1.0.14
 * @since 1.0.0
 */

'use strict';

const path = require('node:path');

const featureFlags = require('../config/featureFlags.cjs');

/**
 * Configures and registers wiki routes with the Express application.
 * Integrates with digital-technologie-core services for data persistence, caching, file storage, etc.
 *
 * @param {Object} options - Configuration options object
 * @param {Object} options.express-app - The Express application instance
 * @param {Object} eventEmitter - Event emitter for logging and notifications
 * @param {Object} services - noobly Core services (dataServe, filing, cache, logger, queue, search)
 * @return {void}
 */
module.exports = (options, eventEmitter, services) => {

  const app = options.app;
  const { dataManager, filing, cache, log, queue, search, settings } = services;
  const logger = log; // Alias for backward compatibility

  // Make sure the wiki feature flags exist in the settings store, so they are
  // visible and editable in the datasources Settings screen from the first boot.
  // Fire-and-forget: registration is synchronous, and the flags fall back to
  // their defaults if this never completes.
  featureFlags.ensureDefaults(settings, logger).catch((error) => {
    logger?.warn(`Wiki feature flags: seeding failed — ${error.message}`);
  });

  // Serve OpenAPI spec — no auth required (documentation)
  const swaggerSpecPath = path.join(__dirname, '../../swagger/openapi.json');
  app.get('/applications/wiki/api/swagger/openapi.json', (req, res) => {
    res.sendFile(swaggerSpecPath);
  });

  // Application status endpoint
  app.get('/applications/wiki/api/status', (req, res) => {
    res.json({
      status: 'running',
      application: 'Wiki Management',
      version: '1.0.0',
      timestamp: new Date().toISOString()
    });
  });

  // Public client config — feature flags read by the web & Teams frontends at
  // load time. No auth required (these are non-sensitive UI toggles).
  //
  // The values come from the core settings store (group "wiki"), editable in the
  // datasources Settings screen — see config/featureFlags.js. An admin's change
  // takes effect on the next page load, with no restart.
  //
  // `no-store` is load-bearing, not hygiene: this response also carries
  // `clientCacheVersion`, the stamp each browser compares against its own to
  // decide whether to drop its cached navigation trees. A cached config answer
  // means the bump never reaches the client and the purge silently never happens
  // — the exact failure this endpoint exists to fix.
  app.get('/applications/wiki/api/config', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(await featureFlags.readFlags(settings, logger));
  });

  // Client cache epoch — read + bump. Bumping makes every browser drop its
  // cached navigation trees on its next page load (see clientCache.js on the
  // frontend). Read is admin-gated too: it exists to drive the admin screen, and
  // the value itself is already public on /api/config.
  const { rolesOf } = require('../components/spacePermissions.cjs');
  const isAdmin = (req) =>
    req.isAuthenticated && req.isAuthenticated() && rolesOf(req.user).includes('admin');

  app.get('/applications/wiki/api/admin/client-cache-version', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({
      success: true,
      clientCacheVersion: await featureFlags.readClientCacheVersion(settings, logger),
      canEdit: isAdmin(req)
    });
  });

  app.post('/applications/wiki/api/admin/client-cache-version', async (req, res) => {
    if (!isAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Admin role required' });
    }
    try {
      const clientCacheVersion = await featureFlags.bumpClientCacheVersion(settings, logger);
      logger?.info(`[Wiki Admin] Client cache version bumped by ${req.user?.email || 'unknown'}`);
      res.json({ success: true, clientCacheVersion });
    } catch (error) {
      logger?.error('[Wiki Admin] Failed to bump client cache version:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Load and register route modules
  const authRoutes = require('./authRoutes.cjs');
  // Browser-assisted Entra sign-in for editor extensions (VS Code, Kiro). An
  // extension has no browser and cannot read one's cookie, so SSO is completed
  // in the user's real browser and handed back over a custom-scheme redirect.
  const editorAuthRoutes = require('./editorAuthRoutes.cjs');
  const documentRoutes = require('./documentRoutes.cjs');
  const spacesRoutes = require('./spacesRoutes.cjs');
  const searchRoutes = require('./searchRoutes.cjs');
  const navigationRoutes = require('./navigationRoutes.cjs');
  const userRoutes = require('./userRoutes.cjs');
  const wizardRoutes = require('./wizardRoutes.cjs');
  const settingsRoutes = require('./settingsRoutes.cjs');
  const aiChatRoutes = require('./aiChatRoutes.cjs');
  const documentationRoutes = require('./documentationRoutes.cjs');
  const pinsRoutes = require('./pinsRoutes.cjs');
  const notesRoutes = require('./notesRoutes.cjs');
  const commentsRoutes = require('./commentsRoutes.cjs');
  const annotationRoutes = require('./annotationRoutes.cjs');
  const userContentRoutes = require('./userContentRoutes.cjs');
  const linkedDocumentsRoutes = require('./linkedDocumentsRoutes.cjs');
  const reviewsRoutes = require('./reviewsRoutes.cjs');
  const likesRoutes = require('./likesRoutes.cjs');
  const changesRoutes = require('./changesRoutes.cjs');
  const continuousExplorationRoutes = require('./continuousExplorationRoutes.cjs');
  const helpRoutes = require('./helpRoutes.cjs');
  const headlineRoutes = require('./headlineRoutes.cjs');
  const whatsNewRoutes = require('./whatsNewRoutes.cjs');
  // NooblyJS Phase 8: sources and import, answer actions, needs review, the process model.
  const knowledgeRoutes = require('./knowledgeRoutes.cjs');
  // MCP endpoint — the runtime counterpart to the OpenAPI spec served above.
  // Its tools call the routes registered here over loopback HTTP, so it must be
  // registered last: the endpoints it consumes have to exist first.
  const mcpRoutes = require('../mcp/mount.cjs');

  // Register all routes
  authRoutes(options, eventEmitter, services);
  editorAuthRoutes(options, eventEmitter, services);
  documentRoutes(options, eventEmitter, services);
  spacesRoutes(options, eventEmitter, services);
  searchRoutes(options, eventEmitter, services);
  navigationRoutes(options, eventEmitter, services);
  userRoutes(options, eventEmitter, services);
  wizardRoutes(options, eventEmitter, services);
  settingsRoutes(options, eventEmitter, services);
  aiChatRoutes(options, eventEmitter, services);
  documentationRoutes(options, eventEmitter, services);
  pinsRoutes(options, eventEmitter, services);
  notesRoutes(options, eventEmitter, services);
  commentsRoutes(options, eventEmitter, services);
  annotationRoutes(options, eventEmitter, services);
  userContentRoutes(options, eventEmitter, services);
  linkedDocumentsRoutes(options, eventEmitter, services);
  reviewsRoutes(options, eventEmitter, services);
  likesRoutes(options, eventEmitter, services);
  changesRoutes(options, eventEmitter, services);
  continuousExplorationRoutes(options, eventEmitter, services);
  helpRoutes(options, eventEmitter, services);
  headlineRoutes(options, eventEmitter, services);
  whatsNewRoutes(options, eventEmitter, services);
  knowledgeRoutes(options, eventEmitter, services);
  mcpRoutes(options, eventEmitter, services);

  // Store dataManager in app for middleware access
  app.set('dataManager', dataManager);

};
