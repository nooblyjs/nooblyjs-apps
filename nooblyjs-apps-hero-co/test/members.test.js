// Settings → Members (roadmap 1.7): the owner invites by email with one role, the invitee joins through the emailed
// link (signing up or signing in), members see but cannot manage, and removal takes access away at once.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, cookieJar } from './helpers.js';

let t;
before(async () => { t = await startApp(); });
after(async () => { await t?.close(); });

const WS = '/api/v1/workspaces/exclusivity-life';
const asJar = (jar, extra = {}) => ({ jar, headers: { origin: t.base }, ...extra });

test('only the owner may invite, and the invitation is emailed with a single-use link', async () => {
  const bad = await t.post(`${WS}/invitations`, { as: 'stevie', body: { email: 'nope' } });
  assert.equal(bad.status, 422);
  assert.equal((await t.post(`${WS}/invitations`, { as: 'stevie', body: { email: 'stevie@exclusivity.life' } })).json.error.details[0].message, 'This person is already a member.');

  const res = await t.post(`${WS}/invitations`, { as: 'stevie', body: { email: 'Grace@Navy.mil' } });
  assert.equal(res.status, 201);
  assert.equal(res.json.email, 'grace@navy.mil');
  assert.equal(res.json.role, 'Member');
  assert.equal(res.json.emailSent, true);
  const mail = t.outbox().at(-1);
  assert.equal(mail.to, 'grace@navy.mil');
  assert.equal(mail.subject, 'Stevie invited you to Exclusivity Life on NooblyJS Cloud');

  const list = await t.get(`${WS}/members`, { as: 'stevie' });
  assert.deepEqual(list.json.members.map((m) => [m.personId, m.role]), [['stevie', 'Owner']]);
  assert.deepEqual(list.json.invitations.map((i) => i.email), ['grace@navy.mil']);
  assert.equal(list.json.canManage, true);
});

test('the invitee signs up from the link and joins as a Member (and gets their own workspace)', async () => {
  const link = await t.linkFor('grace@navy.mil', /invited you to Exclusivity Life/);
  assert.equal(link.pathname, '/invite');
  const token = link.searchParams.get('token');

  const info = await t.get(`/api/v1/invitations/${token}`);
  assert.deepEqual([info.json.inviter.name, info.json.workspace.name, info.json.email, info.json.role], ['Stevie', 'Exclusivity Life', 'grace@navy.mil', 'Member']);
  assert.equal((await t.get(`/api/v1/invitations/${token}`, { as: 'amara' })).json.email, null, 'someone else does not see the invited address');

  const jar = cookieJar();
  const res = await t.post('/api/v1/auth/signup', asJar(jar, { body: { name: 'Grace Hopper', team: 'Compilers', email: 'grace@navy.mil', password: 'first compiler 1952', invite: token } }));
  assert.equal(res.status, 201);
  assert.equal(res.json.redirect, '/w/exclusivity-life');
  const me = (await t.get('/api/v1/me', { jar })).json;
  assert.deepEqual(me.workspaces.map((w) => [w.id, w.role]).sort(), [['compilers', 'Owner'], ['exclusivity-life', 'Member']]);
  assert.equal(me.emailVerified, true, 'following the emailed invitation proves the address');
  assert.equal((await t.get(`/api/v1/invitations/${token}`)).status, 404, 'single use');
});

test('accepting needs the invited email; signing in from the link works', async () => {
  await t.post(`${WS}/invitations`, { as: 'stevie', body: { email: 'amara@example.dev' } });
  const link = await t.linkFor('amara@example.dev', /invited you to Exclusivity Life/);
  const token = link.searchParams.get('token');
  const wrong = await t.post(`/api/v1/invitations/${token}/accept`, { as: 'ops-platform' });
  assert.equal(wrong.status, 403);
  assert.equal(wrong.json.error.code, 'wrong_email');
  const ok = await t.post(`/api/v1/invitations/${token}/accept`, { as: 'amara' });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.redirect, '/w/exclusivity-life');
  assert.equal((await t.get('/w/exclusivity-life', { as: 'amara' })).status, 200);
});

test('members see the member list but cannot invite, rename or remove', async () => {
  const list = await t.get(`${WS}/members`, { as: 'grace@navy.mil' });
  assert.equal(list.status, 200);
  assert.equal(list.json.canManage, false);
  assert.deepEqual(list.json.invitations, [], 'pending invitations are for the owner');
  assert.equal((await t.post(`${WS}/invitations`, { as: 'grace@navy.mil', body: { email: 'x@y.co' } })).status, 403);
  assert.equal((await t.patch(WS, { as: 'grace@navy.mil', body: { name: 'Mine now' } })).status, 403);
  assert.equal((await t.del(`${WS}/members/amara`, { as: 'grace@navy.mil' })).status, 403);
});

test('the owner renames the workspace (its URL stays) and cannot remove themselves', async () => {
  const res = await t.patch(WS, { as: 'stevie', body: { name: 'Exclusivity Life Ltd' } });
  assert.equal(res.status, 200);
  assert.deepEqual(res.json, { id: 'exclusivity-life', name: 'Exclusivity Life Ltd' });
  assert.equal((await t.patch(WS, { as: 'stevie', body: { name: '' } })).status, 422);
  assert.equal((await t.del(`${WS}/members/stevie`, { as: 'stevie' })).status, 409);
});

test('removing a member takes their access away at once; revoking an invitation kills its link', async () => {
  const grace = await t.accounts.findPersonByEmail('grace@navy.mil');
  assert.equal((await t.del(`${WS}/members/${grace.id}`, { as: 'stevie' })).status, 204);
  assert.equal((await t.get('/w/exclusivity-life', { as: 'grace@navy.mil' })).status, 404);
  assert.equal((await t.get(WS, { as: 'grace@navy.mil' })).status, 404);
  assert.equal((await t.del(`${WS}/members/${grace.id}`, { as: 'stevie' })).status, 404);

  const inv = await t.post(`${WS}/invitations`, { as: 'stevie', body: { email: 'later@example.dev' } });
  const link = await t.linkFor('later@example.dev', /invited you/);
  assert.equal((await t.del(`${WS}/invitations/${inv.json.id}`, { as: 'stevie' })).status, 204);
  assert.equal((await t.get(`/api/v1/invitations/${link.searchParams.get('token')}`)).status, 404);
  assert.equal((await t.get(`${WS}/members`, { as: 'stevie' })).json.invitations.length, 0);
});

test('every change is audited, and no customer link or email failed', () => {
  const actions = t.host.auditLog.map((r) => r.action);
  for (const a of ['member.invited', 'invitation.accepted', 'workspace.renamed', 'member.removed', 'member.invitation-revoked']) assert.ok(actions.includes(a), a);
  assert.deepEqual(t.host.auditLog.filter((r) => ['customers.link-failed', 'email.failed'].includes(r.action)), []);
});
