/**
 * @fileoverview Defines and instantiates the NooblyJS CMS application.
 *
 * @author NooblyJS Core Team
 * @version 1.0.1
 * @since 2025-08-24
 */

'use strict';

const express = require('express');
const http = require('http');
const session = require('express-session');
const passport = require('passport');
const path = require('path');
const { EventEmitter } = require('events');

// Initiate the Web and Api Interface
const app = express();
const server = http.createServer(app);
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Sessions let the CMS screens and API see the signed-in user.
const isProduction = process.env.NODE_ENV === 'production';
if (isProduction && !process.env.SESSION_SECRET) {
  console.error('FATAL: SESSION_SECRET must be set in production.');
  process.exit(1);
}
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-only-insecure-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: isProduction,
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000
  }
}));
app.use(passport.initialize());
app.use(passport.session());

// Options. CMS_STORAGE_DIR moves all data, logs and media (the tests use a temp folder).
const storageDir = path.resolve(process.env.CMS_STORAGE_DIR || path.join(__dirname, '.noobly-core'));
var options = { 
  logDir:  path.join(storageDir, 'logs'),
  dataDir : path.join(storageDir, 'data')
};

// initiate the event mechanism
const eventEmitter = new EventEmitter()

// Initiate the service Registry
const serviceRegistry = require('nooblyjs-core');
serviceRegistry.initialize(app, eventEmitter, options);

const log = serviceRegistry.logger('file');
const cache = serviceRegistry.cache('memory');
const dataserve = serviceRegistry.dataService('file');
const filing = serviceRegistry.filing('local', { baseDir: path.join(storageDir, 'media') });
const queue = serviceRegistry.queue('memory');
const scheduling = serviceRegistry.scheduling('memory');
const searching = serviceRegistry.searching('memory');
const measuring = serviceRegistry.measuring('memory');
const notifying = serviceRegistry.notifying('memory');
const worker = serviceRegistry.working('memory');
const workflow = serviceRegistry.workflow('memory');

// instantiate an auth service
const authservice = serviceRegistry.authservice('file');

// The auth provider registers its serializers on nooblyjs-core's own copy of passport,
// so register them on ours as well or req.logIn() fails and login is rejected.
const { serializeUser, deserializeUser } = authservice.getAuthStrategy();
passport.serializeUser(serializeUser);
passport.deserializeUser(deserializeUser);

// Launch the application manager
app.use(express.static(path.join(__dirname, 'public')));

// Launch the application docs folder
app.use('/docs', express.static(path.join(__dirname, 'docs')));

// Serve the application README
app.use('/readme', express.static(path.join(__dirname, 'README.md')));

// Initiate the CMS
const cms = require('.')(app, server, eventEmitter, serviceRegistry, options);

server.listen(process.env.PORT || 3004, () => {
  log.info(`Nooblyjs Content Server running on port ${process.env.PORT || 3004}`);
});

// Write buffered page-view counts before exiting.
const shutdown = async () => {
  await cms.stop();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);