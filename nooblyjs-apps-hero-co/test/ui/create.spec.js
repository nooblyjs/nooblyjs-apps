// Phase 2 in the browser, desktop and phone: Stevie (seeded, GitHub connected) creates a web service from a repo. The
// Summary follows the form, a refused field shows its message under it, and the service page shows the build going
// Live over the live channel. No CSP violation or script error on the way.
import { test, expect } from '@playwright/test';

const WS = '/w/exclusivity-life';

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

test('create a web service from a repo and watch it go Live', async ({ page, context, baseURL }, info) => {
  const res = await context.request.post(`${baseURL}/dev/login`, { form: { person: 'stevie' }, maxRedirects: 0 });
  expect(res.status()).toBe(303);
  const problems = watch(page);

  await page.goto(`${WS}/new/web`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { level: 1, name: 'New Web Service' })).toBeVisible();
  await expect(page.getByText('GitHub connected')).toBeVisible();

  // Pick a repository: the Summary and the name follow it.
  await page.locator('label.nj-repo', { hasText: 'software-factory' }).click();
  const summary = page.getByRole('complementary', { name: 'Summary' });
  await expect(summary.getByText('exclusivity-life / software-factory')).toBeVisible();
  await expect(page.getByLabel('Service name')).toHaveValue('software-factory');

  // The instance type and count change the Compute line.
  await page.locator('label.nj-plan', { hasText: 'Pro Plus' }).click();
  await page.getByLabel('Instances').fill('3');
  await expect(summary.getByText('4 CPU · 8 GB × 3')).toBeVisible();
  await expect(summary.locator('[data-sum="price"]')).toHaveText('$100 / mo');
  await page.getByLabel('Instances').fill('10');
  await expect(summary.locator('[data-sum="price"]')).toHaveText('$100 / mo');
  await page.locator('label.nj-plan', { hasText: 'Standard' }).click();
  await expect(summary.locator('[data-sum="price"]')).toHaveText('$5 / mo');
  await expect(summary.getByText('Sleeps after 15 minutes without requests')).toBeVisible();
  await page.locator('label.nj-plan', { hasText: 'Pro Plus' }).click();
  await page.getByLabel('Instances').fill('3');

  // The URL follows the region: Local network (the default) answers on this site's own URL, a cloud region on its domain.
  await expect(page.locator('[data-url-full]')).toHaveText(`${baseURL}/exclusivity-life/software-factory/`);
  await page.getByLabel('Region').selectOption('af-south');
  await expect(page.locator('[data-url-full]')).toHaveText('software-factory.nooblyjs.app');

  // A refused name shows its message under the field.
  await page.getByLabel('Service name').fill('Bad Name');
  await summary.getByRole('button', { name: 'Deploy web service' }).click();
  await expect(page.locator('.invalid-feedback[data-for="name"]')).toContainText('Lower-case letters');

  const name = `sf-${info.project.name}-${Date.now().toString(36)}`;
  await page.getByLabel('Service name').fill(name);
  await summary.getByRole('button', { name: 'Deploy web service' }).click();
  await expect(page).toHaveURL(new RegExp(`${WS}/services/${name}$`));
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
  await expect(page.locator('[data-status] .nj-pill')).toHaveText('Live', { timeout: 15_000 });
  await expect(page.getByRole('log')).toContainText('Cloning exclusivity-life/software-factory');

  const width = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(width).toBeLessThanOrEqual(0);
  expect(problems).toEqual([]);
});

test('the environment groups and GitHub pages draw for the seeded workspace', async ({ page, context, baseURL }) => {
  await context.request.post(`${baseURL}/dev/login`, { form: { person: 'stevie' }, maxRedirects: 0 });
  const problems = watch(page);
  await page.goto(`${WS}/github`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Connected' })).toBeVisible();
  await expect(page.getByText('exclusivity-life / digital-teammates')).toBeVisible();
  await page.goto(`${WS}/env-groups`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'New environment group' })).toBeVisible();
  await page.goto(`${WS}/new`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('link', { name: 'Which one should I use?' }).click();
  await expect(page.getByRole('heading', { name: 'Which one should I use?', level: 2 })).toBeInViewport();
  expect(problems).toEqual([]);
});
