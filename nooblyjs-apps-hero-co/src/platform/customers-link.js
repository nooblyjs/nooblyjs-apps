// The link to nooblyjs-accel-customers (roadmap 1.5, stack.md §3.3): every person is a customer found by the identity
// `nooblyjs-cloud:<personId>`, every workspace is an organisation, the sign-up form's consent goes on the consent
// ledger, and account emails (verify, welcome, reset, invitation) go out through its transactional send.
//
// The customer record is for operators (the customer 360). A failure here never fails a sign-up: it is logged and
// audited, and the next sign-in tries again.

export const IDENTITY_NAMESPACE = 'nooblyjs-cloud';

/** The sign-up checkbox, word for word (public/js/pages/account.js): the consent ledger keeps what was agreed to. */
export const CONSENT_TEXT = 'Send me product news and tips by email. You can unsubscribe at any time.';
export const CONSENT_TEXT_VERSION = '2026-11-19';

const wrap = (body) => `<!DOCTYPE html><html><body style="font-family:'Plus Jakarta Sans',Arial,sans-serif;color:#241C1A;background:#FBF7F3;padding:24px">${body}<p style="color:#7A6A63;font-size:13px">NooblyJS Cloud</p></body></html>`;

/** Account emails. Keys are fixed; the customers accelerator keeps the content, which operators may edit. */
export const TEMPLATES = [
  {
    key: 'cloud-verify-email',
    name: 'NooblyJS Cloud: verify email',
    variables: [{ name: 'person.name', required: true, sample: 'Stevie' }, { name: 'verifyUrl', required: true, sample: 'https://cloud.example/verify-email?token=x' }],
    subject: 'Verify your email for NooblyJS Cloud',
    html: wrap('<p>Hi {{person.name}},</p><p>Welcome to NooblyJS Cloud. Confirm this is your email address:</p><p><a href="{{verifyUrl}}">Verify email</a></p><p>The link works for 24 hours. If you did not sign up, ignore this email.</p>'),
    text: 'Hi {{person.name}},\n\nWelcome to NooblyJS Cloud. Confirm this is your email address:\n{{verifyUrl}}\n\nThe link works for 24 hours. If you did not sign up, ignore this email.',
  },
  {
    key: 'cloud-welcome',
    name: 'NooblyJS Cloud: welcome',
    variables: [{ name: 'person.name', required: true, sample: 'Stevie' }, { name: 'workspaceUrl', required: true, sample: 'https://cloud.example/w/acme' }],
    subject: 'Welcome to NooblyJS Cloud',
    html: wrap('<p>Hi {{person.name}},</p><p>Your workspace is ready. Connect GitHub and launch your first service:</p><p><a href="{{workspaceUrl}}">Open your workspace</a></p>'),
    text: 'Hi {{person.name}},\n\nYour workspace is ready. Connect GitHub and launch your first service:\n{{workspaceUrl}}',
  },
  {
    key: 'cloud-password-reset',
    name: 'NooblyJS Cloud: reset password',
    variables: [{ name: 'person.name', required: true, sample: 'Stevie' }, { name: 'resetUrl', required: true, sample: 'https://cloud.example/reset-password?token=x' }],
    subject: 'Reset your NooblyJS Cloud password',
    html: wrap('<p>Hi {{person.name}},</p><p>Someone asked to reset the password for this email address. Choose a new password:</p><p><a href="{{resetUrl}}">Reset password</a></p><p>The link works for 1 hour. If it was not you, ignore this email: your password has not changed.</p>'),
    text: 'Hi {{person.name}},\n\nSomeone asked to reset the password for this email address. Choose a new password:\n{{resetUrl}}\n\nThe link works for 1 hour. If it was not you, ignore this email: your password has not changed.',
  },
  {
    key: 'cloud-workspace-invite',
    name: 'NooblyJS Cloud: workspace invitation',
    variables: [{ name: 'inviter.name', required: true, sample: 'Stevie' }, { name: 'workspace.name', required: true, sample: 'Exclusivity Life' }, { name: 'inviteUrl', required: true, sample: 'https://cloud.example/invite?token=x' }],
    subject: '{{inviter.name}} invited you to {{workspace.name}} on NooblyJS Cloud',
    html: wrap('<p>{{inviter.name}} invited you to the <strong>{{workspace.name}}</strong> workspace on NooblyJS Cloud.</p><p><a href="{{inviteUrl}}">Accept the invitation</a></p><p>The invitation works for 7 days.</p>'),
    text: '{{inviter.name}} invited you to the {{workspace.name}} workspace on NooblyJS Cloud.\n\nAccept the invitation:\n{{inviteUrl}}\n\nThe invitation works for 7 days.',
  },
];

/**
 * @param {object} o
 * @param {object} o.cx          what the customers accelerator's mount() returned ({ customer, marketing, ... })
 * @param {(job: string) => object} o.systemContext   the accelerator's systemContext()
 * @param {object} o.accounts
 * @param {object} [o.log]
 * @param {(record: object) => void} [o.audit]
 */
export function createCustomersLink({ cx, systemContext, accounts, log, audit = () => {} }) {
  const ctx = () => systemContext('nooblyjs-cloud');

  /** Creates and approves each template that is missing (idempotent; operators' edits are kept). */
  async function ensureTemplates() {
    const { templates } = cx.marketing.services;
    for (const t of TEMPLATES) {
      let existing = null;
      try {
        existing = await templates.resolve(t.key, ctx());
      } catch (err) {
        if (err.status !== 404 && err.code !== 'not_found') throw err;
      }
      if (existing) continue;
      const created = await templates.create({
        key: t.key, name: t.name, channel: 'email', category: 'transactional',
        variables: t.variables.map((v) => ({ type: 'string', ...v })),
        locales: [{ locale: 'en', subject: t.subject, bodyHtml: t.html, bodyText: t.text }],
      }, ctx());
      await templates.approve(created.id, ctx());
    }
  }

  const splitName = (name) => {
    const parts = String(name).trim().split(/\s+/);
    return parts.length > 1 ? { given: parts.slice(0, -1).join(' '), family: parts.at(-1), full: name } : { given: parts[0], full: name };
  };

  /**
   * The customer behind a person (created or found by identity, then email) and, when given, the workspace's
   * organisation and the sign-up consent.
   * @param {object} person   hero_people record
   * @param {{ workspace?: object, marketingConsent?: boolean, source?: string, request?: { ip?: string, userAgent?: string } }} [o]
   * @returns {Promise<string|null>} customer id
   */
  async function linkPerson(person, { workspace, marketingConsent, source = 'signup', request = {} } = {}) {
    try {
      const { customer } = await cx.customer.upsertByIdentity(
        { namespace: IDENTITY_NAMESPACE, value: person.id, source: 'nooblyjs-cloud' },
        { name: splitName(person.name), email: person.email, source: { channel: 'web', system: 'nooblyjs-cloud', capturedAt: new Date().toISOString() } },
        ctx(),
      );
      if (person.customerId !== customer.id) await accounts.updatePerson(person.id, { customerId: customer.id });

      if (workspace) {
        const organizationId = await linkWorkspace(workspace);
        if (organizationId && !customer.organizationId) await cx.customer.update(customer.id, { organizationId }, ctx());
      }
      if (marketingConsent !== undefined) {
        await cx.customer.recordConsent(customer.id, {
          purpose: 'marketing', channel: 'email', status: marketingConsent ? 'opt_in' : 'opt_out',
          lawfulBasis: 'consent', source: 'form',
          evidence: {
            formId: source, text: CONSENT_TEXT, textVersion: CONSENT_TEXT_VERSION,
            ...(request.ip ? { ip: String(request.ip).slice(0, 64) } : {}),
            ...(request.userAgent ? { userAgent: String(request.userAgent).slice(0, 500) } : {}),
          },
        }, ctx());
      }
      return customer.id;
    } catch (err) {
      log?.warn?.(`[hero-co] customers link failed for ${person.id}: ${err.message}`);
      audit({ action: 'customers.link-failed', actor: person.id, target: person.id, detail: { error: err.message } });
      return null;
    }
  }

  /** The workspace's organisation (created once). @returns {Promise<string|null>} */
  async function linkWorkspace(workspace) {
    const current = await accounts.getWorkspace(workspace.id);
    if (current?.organizationId) return current.organizationId;
    const org = await cx.customer.services.organizations.create({ name: workspace.name }, ctx());
    await accounts.updateWorkspace(workspace.id, { organizationId: org.id });
    return org.id;
  }

  /**
   * Sends an account email. To a person (their customer record) or to an address (invitations).
   * @param {string} template   one of TEMPLATES' keys
   * @param {{ person?: object, to?: string, data: object, idempotencyKey?: string }} o
   * @returns {Promise<boolean>} sent (or queued) without error
   */
  async function send(template, { person, to, data, idempotencyKey }) {
    try {
      let customerId = person?.customerId ?? null;
      if (person && !customerId) customerId = await linkPerson(person);
      await cx.marketing.sendTransactional({
        template,
        ...(customerId ? { customerId } : { to: to ?? person.email }),
        data,
        purpose: 'transactional',
        ...(idempotencyKey ? { idempotencyKey } : {}),
      }, ctx());
      return true;
    } catch (err) {
      log?.warn?.(`[hero-co] email ${template} failed: ${err.message}`);
      audit({ action: 'email.failed', actor: 'system', target: person?.id ?? 'invitation', detail: { template, error: err.message } });
      return false;
    }
  }

  return { ensureTemplates, linkPerson, linkWorkspace, send };
}
