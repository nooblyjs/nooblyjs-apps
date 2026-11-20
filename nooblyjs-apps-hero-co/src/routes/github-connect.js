// Connecting a workspace to GitHub (roadmap 2.4): the Owner opens /w/:workspace/github/connect, GitHub asks them to
// grant repository access, and /auth/github/repo-callback stores the connection. The state (a nonce and the
// workspace) lives in the session, and the callback checks the person is still that workspace's Owner.
import crypto from 'node:crypto';

/**
 * @param {object} o
 * @param {typeof import('express')} o.express
 */
export function createGithubConnect({ express, session, accounts, github, config, audit, log }) {
  const router = express.Router();
  const callback = `${config.publicUrl}/auth/github/repo-callback`;
  const back = (ws, query) => `/w/${encodeURIComponent(ws)}/github?${query}`;

  router.get('/w/:workspace/github/connect', session.requireWorkspace, (req, res) => {
    if (req.workspace.role !== 'Owner') return res.redirect(303, back(req.workspace.id, 'error=owner-only'));
    if (!github.enabled) return res.redirect(303, back(req.workspace.id, 'error=not-configured'));
    const state = crypto.randomBytes(16).toString('hex');
    req.session.githubConnect = { workspaceId: req.workspace.id, state, at: Date.now() };
    res.redirect(302, github.authorizeUrl(state, callback));
  });

  router.get('/auth/github/repo-callback', session.auth, async (req, res) => {
    const intent = req.session.githubConnect;
    delete req.session.githubConnect;
    if (!intent || typeof req.query.state !== 'string' || req.query.state !== intent.state || Date.now() - intent.at > 10 * 60_000) {
      return res.redirect(303, intent ? back(intent.workspaceId, 'error=github') : '/');
    }
    const membership = await accounts.membership(intent.workspaceId, req.person.id).catch(() => null);
    if (membership?.role !== 'Owner') return res.redirect(303, back(intent.workspaceId, 'error=owner-only'));
    try {
      const token = await github.exchange(String(req.query.code ?? ''), callback);
      const c = await github.connect(intent.workspaceId, token, req.person);
      await audit({ action: 'github.connected', actor: req.person.id, target: intent.workspaceId, detail: { login: c.login, organisations: c.organisations } });
      res.redirect(303, back(intent.workspaceId, 'connected=1'));
    } catch (err) {
      log?.warn?.(`[hero-co] GitHub connect for ${intent.workspaceId}: ${err.message}`);
      res.redirect(303, back(intent.workspaceId, 'error=github'));
    }
  });

  return router;
}
