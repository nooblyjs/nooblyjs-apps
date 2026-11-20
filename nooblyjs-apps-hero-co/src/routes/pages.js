// Page routes: every product.md §5 URL answers with the one page shell (public/index.html); the browser router draws
// the screen. Gates run here, so a deep link to another workspace is a 404 before any HTML is sent.
import path from 'node:path';
import { ROOT } from '../config.js';

export const INDEX_FILE = path.join(ROOT, 'public', 'index.html');

/** The workspace pages of product.md §5, relative to /w/:workspace. */
export const WORKSPACE_PAGES = ['', '/new', '/projects', '/deploys', '/metrics', '/logs', '/env-groups', '/github', '/billing', '/settings'];

/** Pages anyone may open (besides /). */
export const PUBLIC_PAGES = ['/forgot-password', '/reset-password', '/verify-email', '/invite'];

/** Service types (product.md §6.2), the :type of /w/:workspace/new/:type. */
export const SERVICE_TYPES = ['static', 'web', 'private', 'worker', 'cron', 'workflow', 'postgres', 'keyvalue', 'sandbox'];

/**
 * @param {object} o
 * @param {typeof import('express')} o.express
 * @param {ReturnType<import('../platform/session.js').createSession>} o.session
 */
export function createPages({ express, session }) {
  const router = express.Router();
  const page = (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.sendFile(INDEX_FILE);
  };

  router.get('/', page);
  // Public pages: sign-in, account emails' links (the page calls the API; a GET never changes anything).
  for (const p of PUBLIC_PAGES) router.get(p, page);
  router.get('/admin', session.requireOperator, page);
  router.get('/w/:workspace', session.requireWorkspace, page);
  for (const sub of WORKSPACE_PAGES.filter(Boolean)) router.get(`/w/:workspace${sub}`, session.requireWorkspace, page);
  router.get('/w/:workspace/new/:type', session.requireWorkspace, (req, res, next) => (SERVICE_TYPES.includes(req.params.type) ? page(req, res) : next()));
  router.get('/w/:workspace/services/:service', session.requireWorkspace, page);
  return router;
}
