// /api/v1/workspaces/:workspace/... : everything inside a workspace. Every route here sits behind
// session.requireWorkspace (router.param), so a person who is not a member gets a 404 from any of them: the isolation
// suite (test/isolation.test.js) walks this router's routes to prove it.
//
// /api/v1/invitations/:token : the invitation link (public read; accept needs a sign-in with the invited email).
import { normaliseEmail } from '../platform/accounts.js';
import { DEFAULT_REGION } from '../platform/accounts.js';
import { addServiceRoutes } from './services.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const sendError = (res, status, code, message, details) => res.status(status).json({ error: { code, message, ...(details ? { details } : {}) } });

/**
 * @param {object} o
 * @param {typeof import('express')} o.express
 * @param {ReturnType<import('../platform/session.js').createSession>} o.session
 * @param {ReturnType<import('../platform/accounts.js').createAccounts>} o.accounts
 * @param {ReturnType<import('../platform/customers-link.js').createCustomersLink>} o.link
 * @param {{ publicUrl: string }} o.config
 * @param {(entry: object) => Promise<void>} o.audit
 * @param {ReturnType<import('../platform/realtime.js').createRealtime>} o.realtime
 * @param {object} [o.records]    services, deploys, env groups, GitHub (src/domain/records.js)
 * @param {object} [o.secrets]
 * @param {object} [o.github]
 * @param {() => object} [o.platform]   the infrastructure accelerator's services.platform
 */
export function createWorkspacesApi({ express, session, accounts, link, config, audit, realtime, records, secrets, github, platform }) {
  const router = express.Router({ mergeParams: true });
  router.use(express.json({ limit: '16kb' }));
  router.param('workspace', (req, res, next) => session.requireWorkspace(req, res, next));
  const W = '/workspaces/:workspace';

  /** The workspace with its projects and environments (the shell, the dashboard lead, Settings). */
  router.get(W, async (req, res, next) => {
    try {
      const ws = await accounts.getWorkspace(req.workspace.id);
      const projects = await accounts.projectsOf(ws.id);
      const environments = await accounts.environmentsOf(ws.id);
      res.json({
        id: ws.id, name: ws.name, role: req.workspace.role, createdAt: ws.createdAt,
        projects: projects.map((p) => ({ id: p.id, name: p.name, isDefault: p.isDefault, environments: environments.filter((e) => e.projectId === p.id).map((e) => ({ id: e.id, name: e.name, region: e.region, regionName: e.region === DEFAULT_REGION.id ? DEFAULT_REGION.name : e.region })) })),
      });
    } catch (err) {
      next(err);
    }
  });

  router.patch(W, session.requireOwner, async (req, res, next) => {
    try {
      const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
      if (!name || name.length > 100) return sendError(res, 422, 'invalid', 'Check the highlighted fields.', [{ path: 'name', message: 'Enter a name of at most 100 characters.' }]);
      const ws = await accounts.updateWorkspace(req.workspace.id, { name });
      await audit({ action: 'workspace.renamed', actor: req.person.id, target: ws.id, detail: { name } });
      realtime.publish(ws.id, 'workspace', { change: 'renamed', name });
      res.json({ id: ws.id, name: ws.name });
    } catch (err) {
      next(err);
    }
  });

  /** Members and pending invitations (Settings → Members). Everyone in the workspace may see them. */
  router.get(`${W}/members`, async (req, res, next) => {
    try {
      const members = await accounts.membersOf(req.workspace.id);
      const invitations = req.workspace.role === 'Owner' ? await accounts.invitationsOf(req.workspace.id) : [];
      res.json({
        members,
        invitations: invitations.map((i) => ({ id: i.id, email: i.email, role: i.role, createdAt: i.createdAt, expiresAt: i.expiresAt })),
        canManage: req.workspace.role === 'Owner',
      });
    } catch (err) {
      next(err);
    }
  });

  /** Invite by email, one role (Member). Owner only. */
  router.post(`${W}/invitations`, session.requireOwner, async (req, res, next) => {
    try {
      const email = normaliseEmail(req.body?.email);
      if (!EMAIL_RE.test(email) || email.length > 254) return sendError(res, 422, 'invalid', 'Check the highlighted fields.', [{ path: 'email', message: 'Enter an email like teammate@company.com.' }]);
      const members = await accounts.membersOf(req.workspace.id);
      if (members.some((m) => m.email === email)) return sendError(res, 422, 'invalid', 'Check the highlighted fields.', [{ path: 'email', message: 'This person is already a member.' }]);
      const { invitation, token } = await accounts.createInvitation({ workspaceId: req.workspace.id, email, invitedBy: req.person.id });
      const sent = await link.send('cloud-workspace-invite', {
        to: email,
        data: { inviter: { name: req.person.name }, workspace: { name: req.workspace.name }, inviteUrl: `${config.publicUrl}/invite?token=${token}` },
      });
      await audit({ action: 'member.invited', actor: req.person.id, target: req.workspace.id, detail: { email, invitationId: invitation.id } });
      res.status(201).json({ id: invitation.id, email, role: invitation.role, expiresAt: invitation.expiresAt, emailSent: sent });
    } catch (err) {
      next(err);
    }
  });

  router.delete(`${W}/invitations/:invitation`, session.requireOwner, async (req, res, next) => {
    try {
      if (!(await accounts.revokeInvitation(req.workspace.id, req.params.invitation))) return sendError(res, 404, 'not_found', 'No such invitation.');
      await audit({ action: 'member.invitation-revoked', actor: req.person.id, target: req.workspace.id, detail: { invitationId: req.params.invitation } });
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  /** Remove a member. Owner only; the owner cannot remove themselves (a workspace always has its owner). */
  router.delete(`${W}/members/:person`, session.requireOwner, async (req, res, next) => {
    try {
      if (req.params.person === req.person.id) return sendError(res, 409, 'conflict', 'You own this workspace, so you cannot remove yourself.');
      const target = await accounts.membership(req.workspace.id, req.params.person);
      if (!target) return sendError(res, 404, 'not_found', 'No such member.');
      if (target.role === 'Owner') return sendError(res, 409, 'conflict', 'The owner cannot be removed.');
      await accounts.removeMember(req.workspace.id, req.params.person);
      await audit({ action: 'member.removed', actor: req.person.id, target: req.workspace.id, detail: { personId: req.params.person } });
      realtime.publish(req.workspace.id, 'workspace', { change: 'member-removed', personId: req.params.person });
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  // Services, environment groups and GitHub (Phase 2).
  addServiceRoutes(router, { session, records, secrets, github, platform, config, audit, realtime, W });

  // ---- invitation links ------------------------------------------------------------

  /** What an invitation link is for. Public: shows the workspace and inviter, and the invited email only to them. */
  router.get('/invitations/:token', async (req, res, next) => {
    try {
      const inv = await accounts.findInvitation(req.params.token);
      if (!inv) return sendError(res, 404, 'not_found', 'This invitation has expired, was revoked or was already used.');
      const ws = await accounts.getWorkspace(inv.workspaceId);
      const inviter = await accounts.getPerson(inv.invitedBy);
      const mine = req.person?.email === inv.email;
      res.json({
        workspace: { name: ws?.name ?? 'a workspace' },
        inviter: { name: inviter?.name ?? 'Someone' },
        role: inv.role,
        email: mine || !req.person ? inv.email : null,
        signedInAs: req.person?.email ?? null,
        canAccept: mine,
        alreadyMember: Boolean(req.person?.workspaces.some((w) => w.id === inv.workspaceId)),
        workspaceId: req.person?.workspaces.some((w) => w.id === inv.workspaceId) ? inv.workspaceId : null,
      });
    } catch (err) {
      next(err);
    }
  });

  router.post('/invitations/:token/accept', session.auth, async (req, res, next) => {
    try {
      const person = await accounts.getPerson(req.person.id);
      const result = await accounts.acceptInvitation(req.params.token, person);
      if (!result.ok && result.reason === 'wrong_email') return sendError(res, 403, 'wrong_email', 'This invitation is for a different email address. Sign in with that address to accept it.');
      if (!result.ok) return sendError(res, 404, 'not_found', 'This invitation has expired, was revoked or was already used.');
      // Following the emailed link proves the address.
      if (!person.emailVerifiedAt) await accounts.updatePerson(person.id, { emailVerifiedAt: new Date().toISOString() });
      await audit({ action: 'invitation.accepted', actor: person.id, target: result.workspaceId });
      realtime.publish(result.workspaceId, 'workspace', { change: 'member-joined', personId: person.id });
      res.json({ redirect: `/w/${result.workspaceId}` });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
