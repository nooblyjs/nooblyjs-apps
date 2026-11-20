/**
 * @fileoverview CMS Application
 * Factory module for creating a CMS application instance.
 *
 * @author NooblyJS Team
 * @version 0.1.0
 * @since  0.0.0
 */

'use strict';

const path = require('path');

const Routes = require('./src/routes');
const Views = require('./src/views');

/**
 * Creates the CMS service
 * Automatically configures routes and views for the cms service.
 * Integrates with noobly-core services for data persistence, file storage, caching, etc.
 * @param {Object} app - The Express application instance
 * @param {Object} server - The HTTP server instance
 * @param {EventEmitter} eventEmitter - Global event emitter for inter-service communication
 * @param {Object} serviceRegistry - NooblyJS Core service registry
 * @param {Object} options - Configuration options
 * @return {{ stop: Function }} Stops background timers and flushes pending view counts
 */
module.exports = (app, server, eventEmitter, serviceRegistry, options) => {

  // Use the same provider instances app.js created; each service:provider pair is a singleton.
  const logger = serviceRegistry.logger('file');
  const dataService = serviceRegistry.dataService('file');
  const filing = serviceRegistry.filing('local');
  const measuring = serviceRegistry.measuring('memory');
  const authService = serviceRegistry.authservice('file');

  const services = { logger, dataService, filing, measuring, authService };

  const cms = Routes({ app, docsDir: path.join(__dirname, 'docs') }, eventEmitter, services);
  Views({ app }, eventEmitter, services);

  // Serve README.md from root directory
  app.get('/applications/cms/README.md', (req, res) => {
    res.sendFile(path.join(__dirname, 'README.md'));
  });

  return cms;
}
