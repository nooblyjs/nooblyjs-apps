'use strict';

const sanitizeHtml = require('sanitize-html');

/**
 * Constants
 */
const VIEW_BASE_PATH = '/applications/cms';
const API_BASE_PATH = `${VIEW_BASE_PATH}/api`;
const MEDIA_BASE_PATH = `${VIEW_BASE_PATH}/media`;
const PUBLIC_BASE_PATH = '/sites';
const LOGIN_PATH = '/services/authservice/views/login.html';

const CONTAINERS = {
  SITES: 'cms_sites',
  PAGES: 'cms_pages',
  VERSIONS: 'cms_versions',
  MEDIA: 'cms_media',
  PAGE_VIEWS: 'cms_page_views'
};

const MAX_VERSIONS_PER_PAGE = 50;

const FONTS = {
  system: { label: 'System', family: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', google: null },
  inter: { label: 'Inter', family: '"Inter", sans-serif', google: 'Inter:wght@400;600;700' },
  roboto: { label: 'Roboto', family: '"Roboto", sans-serif', google: 'Roboto:wght@400;500;700' },
  'open-sans': { label: 'Open Sans', family: '"Open Sans", sans-serif', google: 'Open+Sans:wght@400;600;700' },
  lora: { label: 'Lora', family: '"Lora", serif', google: 'Lora:wght@400;600;700' },
  merriweather: { label: 'Merriweather', family: '"Merriweather", serif', google: 'Merriweather:wght@400;700' },
  'playfair-display': { label: 'Playfair Display', family: '"Playfair Display", serif', google: 'Playfair+Display:wght@400;600;700' }
};

const DEFAULT_SITE_SETTINGS = {
  primaryColor: '#0d6efd',
  backgroundColor: '#ffffff',
  textColor: '#212529',
  headingFont: 'system',
  bodyFont: 'system',
  logoMediaId: null,
  footerText: ''
};

const MEDIA_TYPES = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'application/pdf': '.pdf'
};
const MAX_MEDIA_BYTES = 10 * 1024 * 1024;

/**
 * An error carrying an HTTP status and a stable code for the JSON error body.
 */
class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const badRequest = (message) => new HttpError(400, 'BAD_REQUEST', message);
const forbidden = (message = 'You do not have access to do that.') => new HttpError(403, 'FORBIDDEN', message);
const notFound = (message = 'Not found.') => new HttpError(404, 'NOT_FOUND', message);
const conflict = (message) => new HttpError(409, 'CONFLICT', message);

/**
 * Wraps an async route handler so thrown errors reach sendError.
 * @param {Function} log Logger
 * @param {Function} handler async (req, res) => void
 * @return {Function} Express handler
 */
function route(log, handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      sendError(res, error, log);
    }
  };
}

/**
 * Sends a JSON error body. Unexpected errors are logged and reported as 500.
 */
function sendError(res, error, log) {
  if (error instanceof HttpError) {
    return res.status(error.status).json({ error: { code: error.code, message: error.message } });
  }
  log.error(`CMS request failed: ${error && error.stack ? error.stack : error}`);
  return res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong.' } });
}

/**
 * Normalizes a string into a URL-friendly slug.
 * @param {string} value
 * @return {string}
 */
function toSlug(value = '') {
  return value
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/**
 * Returns a trimmed string, or throws when it is missing/too long.
 */
function requireText(value, field, maxLength = 200) {
  if (typeof value !== 'string' || !value.trim()) {
    throw badRequest(`${field} is required.`);
  }
  if (value.trim().length > maxLength) {
    throw badRequest(`${field} must be ${maxLength} characters or fewer.`);
  }
  return value.trim();
}

/**
 * Returns a trimmed optional string, '' when absent.
 */
function optionalText(value, field, maxLength = 500) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') throw badRequest(`${field} must be text.`);
  if (value.trim().length > maxLength) {
    throw badRequest(`${field} must be ${maxLength} characters or fewer.`);
  }
  return value.trim();
}

/**
 * Validates a slug supplied by the client (or derived from a fallback).
 */
function cleanSlug(value, fallback) {
  const slug = toSlug(value || fallback || '');
  if (!slug) throw badRequest('Slug must contain letters or numbers.');
  return slug;
}

const isHexColor = (value) => typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);

/**
 * Validates site settings, keeping unknown keys out and falling back to defaults.
 */
function cleanSiteSettings(input = {}, current = DEFAULT_SITE_SETTINGS) {
  const settings = { ...DEFAULT_SITE_SETTINGS, ...current };
  ['primaryColor', 'backgroundColor', 'textColor'].forEach((key) => {
    if (input[key] === undefined) return;
    if (!isHexColor(input[key])) throw badRequest(`${key} must be a colour like #1a2b3c.`);
    settings[key] = input[key].toLowerCase();
  });
  ['headingFont', 'bodyFont'].forEach((key) => {
    if (input[key] === undefined) return;
    if (!FONTS[input[key]]) throw badRequest(`${key} is not one of the available fonts.`);
    settings[key] = input[key];
  });
  if (input.logoMediaId !== undefined) {
    settings.logoMediaId = input.logoMediaId ? String(input.logoMediaId) : null;
  }
  if (input.footerText !== undefined) {
    settings.footerText = optionalText(input.footerText, 'Footer text', 500);
  }
  return settings;
}

const MEDIA_URL_PATTERN = new RegExp(`^${MEDIA_BASE_PATH}/[0-9a-f-]+$`);

const SANITIZE_OPTIONS = {
  allowedTags: [
    'p', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'b', 'em', 'i', 'u', 's',
    'sub', 'sup', 'a', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'span', 'img', 'hr', 'iframe'
  ],
  allowedAttributes: {
    '*': ['class', 'style'],
    a: ['href', 'target', 'rel'],
    img: ['src', 'alt', 'width', 'height'],
    iframe: ['src', 'allowfullscreen', 'frameborder'],
    pre: ['spellcheck'],
    li: ['data-list']
  },
  allowedClasses: { '*': ['ql-*'] },
  allowedStyles: {
    '*': {
      color: [/^#[0-9a-fA-F]{3,6}$/, /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/],
      'background-color': [/^#[0-9a-fA-F]{3,6}$/, /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/],
      'text-align': [/^(left|right|center|justify)$/]
    }
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['http', 'https'], iframe: ['https'] },
  allowProtocolRelative: false,
  allowedIframeHostnames: ['www.youtube.com', 'www.youtube-nocookie.com', 'player.vimeo.com'],
  exclusiveFilter: (frame) => {
    // Relative image URLs are only allowed for this app's own media.
    if (frame.tag === 'img') {
      const src = frame.attribs.src || '';
      return !(/^https?:\/\//i.test(src) || MEDIA_URL_PATTERN.test(src));
    }
    return false;
  },
  transformTags: {
    a: (tagName, attribs) => {
      const attrs = { ...attribs };
      if (attrs.target === '_blank') attrs.rel = 'noopener noreferrer';
      else delete attrs.target;
      return { tagName, attribs: attrs };
    }
  }
};

/**
 * Sanitises editor HTML down to the formatting the editor produces.
 * @param {string} html
 * @return {string}
 */
function sanitizeContent(html) {
  if (html === undefined || html === null) return '';
  if (typeof html !== 'string') throw badRequest('Content must be HTML text.');
  if (html.length > 2 * 1024 * 1024) throw badRequest('Content is too large.');
  return sanitizeHtml(html, SANITIZE_OPTIONS);
}

/**
 * Escapes text for safe inclusion in HTML.
 */
function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Builds a logger that tolerates a missing core logger.
 */
function buildLogger(logger) {
  return {
    info: (...args) => (logger ? logger.info(...args) : console.log('[cms]', ...args)),
    warn: (...args) => (logger ? logger.warn(...args) : console.warn('[cms]', ...args)),
    error: (...args) => (logger ? logger.error(...args) : console.error('[cms]', ...args))
  };
}

/**
 * Creates middleware that requires any signed-in NooblyJS user (not just admins).
 * Accepts the passport session, or a bearer/session auth token from the auth service.
 * HTML requests are sent to the core login page; API requests get a 401.
 *
 * @param {Object} authService NooblyJS auth service
 * @return {Function} Express middleware
 */
function createRequireUser(authService) {
  return async (req, res, next) => {
    let user = null;
    if (req.isAuthenticated && req.isAuthenticated() && req.user && req.user.email) {
      user = req.user;
    } else {
      const header = req.headers.authorization || '';
      const token = header.startsWith('Bearer ') ? header.substring(7) : (req.session && req.session.authToken);
      if (token) {
        try {
          const session = await authService.validateSession(token);
          if (session && session.email) {
            user = { email: session.email, fullName: session.fullName, roles: session.roles || [session.role] };
          }
        } catch (error) {
          // Invalid or expired token; treated as signed out.
        }
      }
    }

    if (user) {
      const roles = Array.isArray(user.roles) ? user.roles : [user.role].filter(Boolean);
      req.cmsUser = {
        email: String(user.email).toLowerCase(),
        name: user.fullName || user.email,
        isAdmin: roles.includes('admin')
      };
      return next();
    }

    if (req.method === 'GET' && !req.originalUrl.startsWith(API_BASE_PATH)) {
      return res.redirect(`${LOGIN_PATH}?returnUrl=${encodeURIComponent(req.originalUrl)}`);
    }
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Please sign in.' } });
  };
}

module.exports = {
  VIEW_BASE_PATH,
  API_BASE_PATH,
  MEDIA_BASE_PATH,
  PUBLIC_BASE_PATH,
  LOGIN_PATH,
  CONTAINERS,
  MAX_VERSIONS_PER_PAGE,
  FONTS,
  DEFAULT_SITE_SETTINGS,
  MEDIA_TYPES,
  MAX_MEDIA_BYTES,
  HttpError,
  badRequest,
  forbidden,
  notFound,
  conflict,
  route,
  sendError,
  toSlug,
  requireText,
  optionalText,
  cleanSlug,
  cleanSiteSettings,
  sanitizeContent,
  escapeHtml,
  buildLogger,
  createRequireUser
};
