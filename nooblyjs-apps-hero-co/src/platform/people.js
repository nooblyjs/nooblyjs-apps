// How a person record becomes the person every part of the app sees, and the development people.
//
// Customers belong to workspaces (product.md §7: one role per member, Owner or Member). Operators are NooblyJS staff:
// `operator` is their back-office role, mapped onto the infrastructure accelerator's access roles and the customers
// accelerator's roles below. Operators are never created by sign-up: `node app.js --operator <email> <role>` grants it.

/** Operator roles. */
export const OPERATOR_ROLES = ['platform', 'support'];

/** Operator role → the infrastructure accelerator's access role (its product.md §7). */
export const INFRA_ACCESS_ROLE = { platform: 'Owner', support: 'Viewer' };

/** Operator role → the customers accelerator's roles (its README "Roles"). */
export const CX_ROLES = { platform: ['admin'], support: ['agent'] };

/** The infrastructure accelerator's permission matrix (its product.md §7). Unknown permissions are refused. */
export const INFRA_MATRIX = {
  read: ['Viewer', 'Contributor', 'Approver', 'Architect', 'Owner'],
  draft: ['Contributor', 'Approver', 'Architect', 'Owner'],
  approve: ['Approver', 'Architect', 'Owner'],
  'set-budgets': ['Owner'],
  'change-guardrails': ['Owner'],
};

/**
 * The development people, created on first start outside production (and in tests). Their password is
 * DEV_PASSWORD; the development sign-in at /dev/login needs none.
 */
export const DEV_PASSWORD = 'development-only-1';
export const DEV_PEOPLE = [
  { id: 'stevie', name: 'Stevie', email: 'stevie@exclusivity.life', workspace: { id: 'exclusivity-life', name: 'Exclusivity Life' } },
  { id: 'amara', name: 'Amara', email: 'amara@example.dev', workspace: { id: 'amara-labs', name: 'Amara Labs' } },
  { id: 'ops-platform', name: 'Platform engineer', email: 'platform@nooblyjs.cloud', operator: 'platform' },
  { id: 'ops-support', name: 'Support agent', email: 'support@nooblyjs.cloud', operator: 'support' },
];

/**
 * The person as every part of the app sees it: workspaces for our pages, `accessRole` for the infrastructure
 * accelerator, `cxRoles` for the customers accelerator.
 * @param {object|null} record     hero_people record
 * @param {{ id: string, name: string, role: string }[]} [workspaces]
 */
export function toPerson(record, workspaces = []) {
  if (!record) return null;
  return {
    id: record.id,
    name: record.name,
    email: record.email,
    emailVerified: Boolean(record.emailVerifiedAt),
    githubLogin: record.githubLogin ?? null,
    operator: record.operator ?? null,
    accessRole: record.operator ? INFRA_ACCESS_ROLE[record.operator] : null,
    cxRoles: record.operator ? CX_ROLES[record.operator] : [],
    workspaces,
  };
}
