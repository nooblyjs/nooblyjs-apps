'use strict';

const path = require('path');
const express = require('express');
const { VIEW_BASE_PATH, buildLogger, createRequireUser } = require('../routes/shared/helpers');

const STATIC_PATH = `${VIEW_BASE_PATH}/assets`;

/**
 * Registers the CMS screens (dashboard, site, page editor) and their static assets.
 *
 * @param {Object} options Express binding: { app }
 * @param {import('events').EventEmitter} eventEmitter
 * @param {Object} services NooblyJS services (logger, authService)
 */
module.exports = (options, eventEmitter, services) => {
  const app = options.app;
  const log = buildLogger(services.logger);
  const requireUser = createRequireUser(services.authService);

  app.use(`${STATIC_PATH}/css`, express.static(path.join(__dirname, 'css')));
  app.use(`${STATIC_PATH}/js`, express.static(path.join(__dirname, 'js')));

  const screen = (file) => (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.sendFile(path.join(__dirname, file));
  };

  // Express ignores trailing slashes when matching, so add the slash here rather than in a second route.
  app.get(VIEW_BASE_PATH, (req, res, next) => (
    req.path.endsWith('/') ? next() : res.redirect(`${VIEW_BASE_PATH}/`)
  ), requireUser, screen('dashboard.html'));
  app.get(`${VIEW_BASE_PATH}/sites/:siteId`, requireUser, screen('site.html'));
  app.get(`${VIEW_BASE_PATH}/sites/:siteId/pages/:pageId`, requireUser, screen('editor.html'));

  log.info(`CMS views registered at ${VIEW_BASE_PATH}`);
};
