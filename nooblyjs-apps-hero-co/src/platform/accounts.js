// Accounts: people, workspaces, memberships, projects, environments, invitations and one-time tokens, as records in
// nooblyjs-core's dataService (stack.md D5: `file` in development and tests, `mongodb` in production).
//
// Passwords are not here: nooblyjs-core's authservice keeps them (src/platform/auth.js). A person's `id` is ours; the
// authservice user is found by the person's email.
//
// Lookups scan a container. That is fine for v1 volumes; the MongoDB provider gets indexes when it lands.
import crypto from 'node:crypto';

export const CONTAINERS = {
  people: 'hero_people',
  workspaces: 'hero_workspaces',
  memberships: 'hero_memberships',
  projects: 'hero_projects',
  environments: 'hero_environments',
  invitations: 'hero_invitations',
  tokens: 'hero_tokens',
};

/** product.md §7: one role per member. */
export const ROLES = ['Owner', 'Member'];
export const DEFAULT_REGION = { id: 'af-south', name: 'Johannesburg' };
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const now = () => new Date().toISOString();
const newId = (prefix) => `${prefix}_${crypto.randomBytes(9).toString('base64url').toLowerCase().replace(/[^a-z0-9]/g, '0')}`;
export const hashToken = (raw) => crypto.createHash('sha256').update(String(raw)).digest('hex');
export const normaliseEmail = (email) => String(email ?? '').trim().toLowerCase();

/** "Exclusivity Life" → "exclusivity-life". Workspace ids are URL segments (/w/:workspace). */
export function slugify(name) {
  const slug = String(name ?? '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 40).replace(/-+$/, '');
  return slug.length >= 2 ? slug : `workspace${slug ? `-${slug}` : ''}`;
}

/** Reserved so a workspace id never shadows a route of ours. */
const RESERVED = new Set(['new', 'admin', 'api', 'auth', 'dev', 'signin', 'settings', 'services', 'workspace']);

/**
 * @param {object} o
 * @param {object} o.data   a nooblyjs-core dataService (add/addWithKey/getByUuid/update/remove/listAll/createContainer)
 */
export function createAccounts({ data }) {
  const C = CONTAINERS;
  const all = (container) => data.listAll(container);
  const get = async (container, id) => (id ? (await data.getByUuid(container, id)) ?? null : null);
  const put = (container, record) => data.addWithKey(container, record.id, record);
  const where = async (container, test) => (await all(container)).filter(test);
  const first = async (container, test) => (await all(container)).find(test) ?? null;

  async function init() {
    for (const name of Object.values(C)) {
      try {
        await data.createContainer(name);
      } catch (err) {
        if (!/already exists/.test(err.message)) throw err;
      }
    }
  }

  // ---- people ---------------------------------------------------------------

  const getPerson = (id) => get(C.people, id);
  const findPersonByEmail = (email) => first(C.people, (p) => p.email === normaliseEmail(email));
  const findPersonByGithub = (githubId) => first(C.people, (p) => p.githubId && p.githubId === String(githubId));
  const listPeople = () => all(C.people);

  /** @param {{ id?: string, name: string, email: string, emailVerified?: boolean, githubId?: string, githubLogin?: string, operator?: string, signedUpWith: string }} input */
  async function createPerson(input) {
    const email = normaliseEmail(input.email);
    if (await findPersonByEmail(email)) throw Object.assign(new Error('An account with this email exists.'), { code: 'email_taken' });
    const person = {
      id: input.id ?? newId('p'),
      name: String(input.name).trim(),
      email,
      emailVerifiedAt: input.emailVerified ? now() : null,
      githubId: input.githubId ? String(input.githubId) : null,
      githubLogin: input.githubLogin ?? null,
      operator: input.operator ?? null,
      sessionEpoch: 0,
      customerId: null,
      signedUpWith: input.signedUpWith,
      createdAt: now(),
    };
    await put(C.people, person);
    return person;
  }

  async function updatePerson(id, patch) {
    const person = await getPerson(id);
    if (!person) return null;
    const next = { ...person, ...patch, id, updatedAt: now() };
    await data.update(C.people, id, next);
    return next;
  }

  // ---- workspaces, projects, environments --------------------------------------

  const getWorkspace = (id) => get(C.workspaces, id);

  async function freeWorkspaceId(name) {
    const base = slugify(name);
    const taken = new Set((await all(C.workspaces)).map((w) => w.id));
    for (let n = 1; ; n += 1) {
      const id = n === 1 ? base : `${base.slice(0, 36)}-${n}`;
      if (!taken.has(id) && !RESERVED.has(id)) return id;
    }
  }

  /**
   * A workspace with its owner, a default project and a Production environment (product.md §6.1).
   * @param {{ name: string, ownerId: string, id?: string }} input
   */
  async function createWorkspace({ name, ownerId, id }) {
    const workspace = { id: id ?? await freeWorkspaceId(name), name: String(name).trim(), createdBy: ownerId, organizationId: null, createdAt: now() };
    await put(C.workspaces, workspace);
    await put(C.memberships, { id: newId('m'), workspaceId: workspace.id, personId: ownerId, role: 'Owner', createdAt: now() });
    const project = { id: newId('prj'), workspaceId: workspace.id, name: 'Default', isDefault: true, createdAt: now() };
    await put(C.projects, project);
    await put(C.environments, { id: newId('env'), workspaceId: workspace.id, projectId: project.id, name: 'Production', region: DEFAULT_REGION.id, createdAt: now() });
    return workspace;
  }

  async function updateWorkspace(id, patch) {
    const workspace = await getWorkspace(id);
    if (!workspace) return null;
    const next = { ...workspace, ...patch, id, updatedAt: now() };
    await data.update(C.workspaces, id, next);
    return next;
  }

  const projectsOf = (workspaceId) => where(C.projects, (p) => p.workspaceId === workspaceId);
  const environmentsOf = (workspaceId) => where(C.environments, (e) => e.workspaceId === workspaceId);

  // ---- memberships --------------------------------------------------------------

  const membership = (workspaceId, personId) => first(C.memberships, (m) => m.workspaceId === workspaceId && m.personId === personId);

  /** The person's workspaces, oldest membership first: [{ id, name, role }]. */
  async function workspacesFor(personId) {
    const mine = (await where(C.memberships, (m) => m.personId === personId)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const out = [];
    for (const m of mine) {
      const w = await getWorkspace(m.workspaceId);
      if (w) out.push({ id: w.id, name: w.name, role: m.role });
    }
    return out;
  }

  /** Members with their names and emails, owners first. */
  async function membersOf(workspaceId) {
    const ms = await where(C.memberships, (m) => m.workspaceId === workspaceId);
    const out = [];
    for (const m of ms) {
      const p = await getPerson(m.personId);
      if (p) out.push({ personId: p.id, name: p.name, email: p.email, role: m.role, since: m.createdAt });
    }
    return out.sort((a, b) => (a.role === b.role ? a.since.localeCompare(b.since) : a.role === 'Owner' ? -1 : 1));
  }

  async function addMember(workspaceId, personId, role = 'Member') {
    const existing = await membership(workspaceId, personId);
    if (existing) return existing;
    const m = { id: newId('m'), workspaceId, personId, role, createdAt: now() };
    await put(C.memberships, m);
    return m;
  }

  async function removeMember(workspaceId, personId) {
    const m = await membership(workspaceId, personId);
    if (!m) return false;
    return data.remove(C.memberships, m.id);
  }

  // ---- invitations ----------------------------------------------------------------

  /** @returns {Promise<{ invitation: object, token: string }>} the raw token goes in the email only */
  async function createInvitation({ workspaceId, email, invitedBy, role = 'Member' }) {
    const address = normaliseEmail(email);
    for (const old of await where(C.invitations, (i) => i.workspaceId === workspaceId && i.email === address && !i.acceptedAt && !i.revokedAt)) {
      await data.update(C.invitations, old.id, { ...old, revokedAt: now(), revokedReason: 'replaced' });
    }
    const token = crypto.randomBytes(32).toString('base64url');
    const invitation = {
      id: newId('inv'), workspaceId, email: address, role, invitedBy, tokenHash: hashToken(token),
      createdAt: now(), expiresAt: new Date(Date.now() + INVITE_TTL_MS).toISOString(), acceptedAt: null, revokedAt: null,
    };
    await put(C.invitations, invitation);
    return { invitation, token };
  }

  const isOpen = (i) => i && !i.acceptedAt && !i.revokedAt && i.expiresAt > now();

  /** Pending invitations of a workspace (never the token hash). */
  async function invitationsOf(workspaceId) {
    return (await where(C.invitations, (i) => i.workspaceId === workspaceId && isOpen(i)))
      .map(({ tokenHash, ...rest }) => rest) // eslint-disable-line no-unused-vars
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async function findInvitation(token) {
    if (!token || typeof token !== 'string' || token.length > 200) return null;
    const hash = hashToken(token);
    const inv = await first(C.invitations, (i) => i.tokenHash === hash);
    return isOpen(inv) ? inv : null;
  }

  async function revokeInvitation(workspaceId, id) {
    const inv = await get(C.invitations, id);
    if (!inv || inv.workspaceId !== workspaceId || !isOpen(inv)) return false;
    await data.update(C.invitations, id, { ...inv, revokedAt: now(), revokedReason: 'revoked' });
    return true;
  }

  /** Joins the invitation's workspace. The invitation must be open and addressed to the person's email. */
  async function acceptInvitation(token, person) {
    const inv = await findInvitation(token);
    if (!inv) return { ok: false, reason: 'invalid' };
    if (inv.email !== person.email) return { ok: false, reason: 'wrong_email', email: inv.email };
    await addMember(inv.workspaceId, person.id, inv.role);
    await data.update(C.invitations, inv.id, { ...inv, acceptedAt: now(), acceptedBy: person.id });
    return { ok: true, workspaceId: inv.workspaceId };
  }

  // ---- one-time tokens (verify email, reset password) --------------------------------

  /** @returns {Promise<string>} the raw token; only its hash is stored */
  async function issueToken(kind, personId, ttlMs) {
    for (const old of await where(C.tokens, (t) => t.kind === kind && t.personId === personId && !t.usedAt)) {
      await data.update(C.tokens, old.id, { ...old, usedAt: now(), usedReason: 'replaced' });
    }
    const raw = crypto.randomBytes(32).toString('base64url');
    await put(C.tokens, { id: hashToken(raw), kind, personId, createdAt: now(), expiresAt: new Date(Date.now() + ttlMs).toISOString(), usedAt: null });
    return raw;
  }

  /** Uses a token once. @returns {Promise<string|null>} the person id */
  async function consumeToken(kind, raw) {
    if (!raw || typeof raw !== 'string' || raw.length > 200) return null;
    const t = await get(C.tokens, hashToken(raw));
    if (!t || t.kind !== kind || t.usedAt || t.expiresAt <= now()) return null;
    await data.update(C.tokens, t.id, { ...t, usedAt: now() });
    return t.personId;
  }

  return {
    init,
    getPerson, findPersonByEmail, findPersonByGithub, listPeople, createPerson, updatePerson,
    getWorkspace, createWorkspace, updateWorkspace, projectsOf, environmentsOf,
    listWorkspaces: () => all(C.workspaces),
    membership, workspacesFor, membersOf, addMember, removeMember,
    createInvitation, invitationsOf, findInvitation, revokeInvitation, acceptInvitation,
    issueToken, consumeToken,
  };
}
