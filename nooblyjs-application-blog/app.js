/**
 * @fileoverview The file define and instantiates the various NooblyJS applications.
 *
 * @author NooblyJS Core Team
 * @version 1.0.1
 * @since 2025-08-24
 */

'use strict';

const path = require('path');

// Settings such as AUTH_METHOD and GOOGLE_AUTH_* come from ./.env; variables already set in the environment win.
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });

const express = require('express');
const http = require('http');
const bodyParser = require('body-parser');
const session = require('express-session');
const passport = require('passport');

const { EventEmitter } = require('events');

// Iniitiate the Web and Api Interface
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3003;

// The redirect URI registered with Google is the app's base URL followed by this path.
const GOOGLE_CALLBACK_PATH = '/services/authservice/openid';

// AUTH_METHOD picks how authors sign in: 'local' (email and password, the default) or 'google'.
// The password form stays available at /services/authservice/views/login.html?local=1 either way.
const AUTH_METHOD = (() => {
  const method = (process.env.AUTH_METHOD || 'local').trim().toLowerCase();
  if (method === 'google') {
    if (process.env.GOOGLE_AUTH_CLIENTID && process.env.GOOGLE_AUTH_SECRET) return 'google';
    console.warn('AUTH_METHOD=google but GOOGLE_AUTH_CLIENTID / GOOGLE_AUTH_SECRET are not set; using local sign-in.');
  } else if (method !== 'local') {
    console.warn(`AUTH_METHOD=${method} is not available in the blog (use local or google); using local sign-in.`);
  }
  return 'local';
})();

app.use(bodyParser.urlencoded({ extended: true, limit: '2mb' }));
app.use(bodyParser.json({ limit: '2mb' }));

// Sessions let the author dashboard and API writes see the logged-in user.
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
    // Google sends the browser back with a cross-site redirect, and a strict cookie would be left off it.
    sameSite: AUTH_METHOD === 'google' ? 'lax' : 'strict',
    maxAge: 24 * 60 * 60 * 1000
  }
}));
app.use(passport.initialize());
app.use(passport.session());

// Initialise our options
var options = { 
  logDir:  path.join(__dirname, './.app-blog/', 'logs'),
  dataDir : path.join(__dirname, './.app-blog/', 'data'),
};

// Initialise event system
const eventEmitter = new EventEmitter()  

// Initiate the service Registry
const serviceRegistry = require('nooblyjs-core');
serviceRegistry.initialize(app,eventEmitter,options);

const log = serviceRegistry.logger('console');
const cache = serviceRegistry.cache('memory');
const dataservice = serviceRegistry.dataService('memory');
const filing = serviceRegistry.filing('local');
const queue = serviceRegistry.queue('memory');
const scheduling = serviceRegistry.scheduling('memory');
const searching = serviceRegistry.searching('memory');
const measuring = serviceRegistry.measuring('memory');
const notifying = serviceRegistry.notifying('memory');
const worker = serviceRegistry.working('memory');
const workflow = serviceRegistry.workflow('memory');

// The login page asks this whether to send people straight to an SSO provider. Core's answer only knows
// Azure (and offers it whenever AZURE_AD_* is set), so answer for the blog before the file provider below
// registers core's route.
app.get('/services/authservice/api/sso-config', (req, res) => {
  const google = AUTH_METHOD === 'google';
  res.json({
    success: true,
    data: { enabled: google, provider: google ? 'google' : null, initiateUrl: google ? GOOGLE_CALLBACK_PATH : null }
  });
});

const authservice = serviceRegistry.authservice('file',{
  saveReferer: true,
});

// The auth provider registers its serializers on nooblyjs-core's own copy of passport,
// so register them on ours as well or req.logIn() fails and login is rejected.
const { serializeUser, deserializeUser } = authservice.getAuthStrategy();
passport.serializeUser(serializeUser);
passport.deserializeUser(deserializeUser);

if (AUTH_METHOD === 'google') {
  const googleAuth = serviceRegistry.authservice('google', {
    'express-app': null, // the file provider has already added the auth routes and passport middleware
    clientID: process.env.GOOGLE_AUTH_CLIENTID,
    clientSecret: process.env.GOOGLE_AUTH_SECRET,
    // Left relative when GOOGLE_AUTH_BASE_URL is unset, so passport takes the base URL from the request.
    callbackURL: (process.env.GOOGLE_AUTH_BASE_URL || '').replace(/\/+$/, '') + GOOGLE_CALLBACK_PATH
  });

  // Unlike the azure provider, core's google provider has no userStore option and keeps users in memory.
  // Point it at the file provider so Google users persist, deserialize, and keep any role an admin gives them.
  // The email is what links a Google account to an existing user, so it must be verified, and Google's
  // tokens stay out of users.json because the blog never calls Google with them.
  const handleGoogleAuth = googleAuth.handleGoogleAuth_.bind(googleAuth);
  Object.assign(googleAuth, {
    getUser: (email) => authservice.getUser(email),
    createUser: (user) => authservice.createUser(user),
    updateUser: (email, { accessToken, refreshToken, ...updates }) => authservice.updateUser(email, updates),
    handleGoogleAuth_: (profile, ...rest) => {
      if (profile.emails?.[0]?.verified !== true) {
        throw new Error('Google did not return a verified email address');
      }
      return handleGoogleAuth(profile, ...rest);
    }
  });

  // The login page starts the sign-in here, and Google comes back here with ?code (or ?error).
  app.get(GOOGLE_CALLBACK_PATH, async (req, res, next) => {
    try {
      if (!req.query.code && !req.query.error) {
        return googleAuth.initiateGoogleAuth(req, res, next);
      }
      const result = await googleAuth.handleGoogleCallback(req, res, next);
      res.redirect(result.redirectUrl || '/applications/blog/');
    } catch (err) {
      log.error('Google sign-in failed', { error: err.message, code: err.code });
      // ?local=1 shows the password form instead of sending the browser straight back to Google.
      res.redirect('/services/authservice/views/login.html?local=1&error=' +
        encodeURIComponent('Google sign-in failed. Please try again or sign in with your password.'));
    }
  });
}

// Launch the application docs folder
app.use('/docs', express.static(path.join(__dirname, 'docs')));

// Launch the application docs folder
app.use('/readme', express.static(path.join(__dirname, 'README.md')));

const blog = require('./index.js');
blog(app, server, eventEmitter, serviceRegistry,{});


// Redirect to services
app.get('/', (req, res) => {
  res.redirect('/applications/blog/');
});

server.listen(process.env.PORT || 3003, () => {
  log.warn(`====================================`);
  log.warn(`Nooblyjs Blog running on port ${process.env.PORT || 3003}`);
  log.warn(`Sign-in method: ${AUTH_METHOD}`);
  log.warn(`====================================`);
});