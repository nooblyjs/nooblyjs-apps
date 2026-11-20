// Phase 0 smoke test, desktop and phone: every route draws its screen with no CSP violation or script error, deep
// links and client-side navigation work, the phone layout has no horizontal scroll, operators reach the back office.
import { test, expect } from '@playwright/test';

const WS = '/w/exclusivity-life';
const SCREENS = [
  [WS, 'Production', 'Dashboard'],
  [`${WS}/new`, 'What are you launching?', 'New service'],
  [`${WS}/new/web`, 'New Web Service', 'New service'],
  [`${WS}/new/sandbox`, 'New Sandbox Group', 'New service'],
  [`${WS}/services/api`, 'api', 'Dashboard'],
  [`${WS}/projects`, 'Projects', 'Projects'],
  [`${WS}/deploys`, 'Deploys', 'Deploys'],
  [`${WS}/metrics`, 'Metrics', 'Metrics'],
  [`${WS}/logs`, 'Logs', 'Logs'],
  [`${WS}/env-groups`, 'Environment groups', 'Environment groups'],
  [`${WS}/github`, 'GitHub', 'GitHub'],
  [`${WS}/billing`, 'Billing', 'Billing'],
  [`${WS}/settings`, 'Settings', 'Settings'],
];
const runId = () => `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;

/** Collects CSP violations and script errors. External stylesheet/font downloads may fail offline; those are not ours. */
function watch(page) {
  const problems = [];
  page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    const text = msg.text();
    if (/Content Security Policy|Refused to (load|apply|execute)/i.test(text)) problems.push(`csp: ${text}`);
    else if (msg.type() === 'error' && !/Failed to load resource/.test(text)) problems.push(`console: ${text}`);
  });
  return problems;
}

/** The development sign-in, through the context's request so the session cookie lands in the browser. */
async function signIn(context, baseURL, person) {
  const res = await context.request.post(`${baseURL}/dev/login`, { form: { person }, maxRedirects: 0 });
  expect(res.status()).toBe(303);
}

async function noHorizontalScroll(page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, 'no horizontal page scroll').toBeLessThanOrEqual(1);
}

test('the marketing page draws for a signed-out visitor', async ({ page }) => {
  const problems = watch(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('From a GitHub repo to a live service, without the ops work.');
  await expect(page.getByText('Runs on NooblyJS Engineering')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Continue with GitHub' })).toBeVisible();
  await noHorizontalScroll(page);
  expect(problems).toEqual([]);
});

test('every workspace screen draws with its title and the current sidebar row', async ({ page, context, baseURL }) => {
  await signIn(context, baseURL, 'stevie');
  const problems = watch(page);
  for (const [url, title, nav] of SCREENS) {
    // Not 'load': that waits on the CDN's stylesheets and fonts too; the assertions below wait for the screen.
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1 }), url).toHaveText(title);
    await expect(page.getByRole('navigation', { name: 'Workspace' }).locator('a[aria-current="page"]'), url).toHaveText(nav);
    await expect(page.locator('.nj-workspace-switch'), url).toContainText('Exclusivity Life');
    await noHorizontalScroll(page);
  }
  expect(problems).toEqual([]);
});

test('sidebar links navigate without a full page load, and back works', async ({ page, context, baseURL }, testInfo) => {
  await signIn(context, baseURL, 'stevie');
  await page.goto(WS);
  await page.evaluate(() => { window.__noReload = true; });
  const nav = page.getByRole('navigation', { name: 'Workspace' });
  if (testInfo.project.name === 'phone') await nav.getByRole('link', { name: 'Logs' }).scrollIntoViewIfNeeded();
  await nav.getByRole('link', { name: 'Logs' }).click();
  await expect(page).toHaveURL(`${baseURL}${WS}/logs`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Logs');
  expect(await page.evaluate(() => window.__noReload)).toBe(true);
  await page.goBack();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Production');
});

test('the service picker links each type to its create screen', async ({ page, context, baseURL }) => {
  await signIn(context, baseURL, 'stevie');
  await page.goto(`${WS}/new`);
  await expect(page.locator('.nj-option')).toHaveCount(9);
  await expect(page.getByText('Beta')).toBeVisible();
  await page.getByRole('link', { name: /Key Value/ }).click();
  await expect(page).toHaveURL(`${baseURL}${WS}/new/keyvalue`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('New Key Value');
});

test('another workspace is not found', async ({ page, context, baseURL }) => {
  await signIn(context, baseURL, 'amara');
  const res = await page.goto(WS);
  expect(res.status()).toBe(404);
});

test('operators reach the back office and the infrastructure accelerator in the nooblyjs-core frame', async ({ page, context, baseURL }) => {
  await signIn(context, baseURL, 'ops-platform');
  const problems = watch(page);
  await page.goto('/admin');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Back office');
  await expect(page.locator('.nj-accelerators .nj-card')).toHaveCount(3);
  await expect(page.getByText('Not built yet: nooblyjs-accel-payments roadmap Phase 0.')).toBeVisible();
  await noHorizontalScroll(page);
  expect(problems).toEqual([]);

  const infra = await page.goto('/infrastructure/');
  expect(infra.status()).toBe(200);
  await expect(page.locator('body')).toContainText(/Infrastructure|Noobly Cloud/, { timeout: 15_000 });
});

test('sign up with email through the form: field errors, then the new workspace with the verify banner', async ({ page }) => {
  const problems = watch(page);
  const id = runId();
  await page.goto('/');
  await page.getByLabel('Your name').fill('Ada Lovelace');
  await page.getByLabel('Team or company').fill(`Engines ${id}`);
  await page.getByLabel('Work email').fill(`ada-${id}@engines.dev`);
  await page.getByLabel('Password').fill('short');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.locator('[data-for="password"]')).toHaveText('Use 12 or more characters with a number.');
  await expect(page.getByLabel('Password')).toHaveAttribute('aria-invalid', 'true');
  await page.getByLabel('Password').fill('difference engine 1');
  await page.getByLabel(/product news/).check();
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(new RegExp(`/w/engines-${id}$`));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Production');
  await expect(page.getByText(/0 services · Johannesburg \(af-south\)/)).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Verify your email' })).toBeVisible();
  await page.getByRole('button', { name: 'Send it again' }).click();
  await expect(page.getByRole('button', { name: 'Sent' })).toBeVisible();
  await noHorizontalScroll(page);
  expect(problems).toEqual([]);
});

test('Continue with GitHub signs up through the mock GitHub and lands in a workspace', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Continue with GitHub' }).click();
  await expect(page.getByRole('heading', { name: 'Authorize NooblyJS Cloud' })).toBeVisible();
  await page.getByRole('button', { name: 'octo-dev' }).click();
  await expect(page).toHaveURL(/\/w\/octo-developer$/);
  await expect(page.locator('.nj-workspace-switch')).toContainText('Octo Developer');
  await expect(page.getByText('Verify your email')).toHaveCount(0);
});

test('sign in is nooblyjs-core\'s login page: back to the page you wanted; a wrong password says so; sign out', async ({ page }) => {
  const problems = watch(page);
  await page.goto(`${WS}/settings`, { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/services\/authservice\/views\/login\.html\?returnUrl=%2Fw%2Fexclusivity-life%2Fsettings$/);
  await expect(page.locator('#app-name')).toHaveText('NooblyJS Cloud');
  await page.getByLabel('Email').fill('stevie@exclusivity.life');
  await page.getByLabel('Password').fill('not the password 1');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page.locator('#login-btn')).toHaveText('Login failed try again');
  await page.getByLabel('Password').fill('development-only-1');
  await page.locator('#login-btn').click();
  await expect(page).toHaveURL(new RegExp(`${WS}/settings$`), { timeout: 10_000 });
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
  expect(problems).toEqual([]);
});

test('operators sign in on the same page and land on /admin', async ({ page }) => {
  await page.goto('/signin', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/services\/authservice\/views\/login\.html$/);
  await page.getByLabel('Email').fill('platform@nooblyjs.cloud');
  await page.getByLabel('Password').fill('development-only-1');
  await page.locator('#login-btn').click();
  await expect(page).toHaveURL(/\/admin$/, { timeout: 10_000 });
  await expect(page.getByRole('heading', { level: 1, name: 'Back office' })).toBeVisible();
});

test('Settings: the owner invites a member and sees the invitation', async ({ page, context, baseURL }) => {
  await signIn(context, baseURL, 'stevie');
  const problems = watch(page);
  await page.goto(`${WS}/settings`);
  await expect(page.getByRole('table')).toContainText('stevie@exclusivity.life');
  const email = `teammate-${runId()}@exclusivity.life`;
  await page.getByLabel('Invite by email').fill(email);
  await page.getByRole('button', { name: 'Send invitation' }).click();
  await expect(page.getByText(`Invitation sent to ${email}.`)).toBeVisible();
  await expect(page.getByRole('row', { name: new RegExp(email) })).toContainText('Invited');
  await noHorizontalScroll(page);
  expect(problems).toEqual([]);
});
