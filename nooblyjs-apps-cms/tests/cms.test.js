'use strict';

/**
 * End-to-end tests for the CMS API and public site rendering.
 * Starts app.js on a spare port with a temporary storage folder.
 */

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');

const ADMIN = { email: 'admin@localhost', password: 'Admin-Test-Pass-123!' };
const EDITOR = { email: 'editor@example.com', password: 'Editor-Test-Pass-456!', fullName: 'Ed Itor' };
const API = '/applications/cms/api';

// Smallest valid PNG: 1x1 transparent pixel.
const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64'
);

let server;
let baseUrl;
let storageDir;

const freePort = () => new Promise((resolve, reject) => {
  const srv = net.createServer();
  srv.listen(0, () => {
    const { port } = srv.address();
    srv.close(() => resolve(port));
  });
  srv.on('error', reject);
});

/**
 * A tiny HTTP client that keeps the session cookie.
 */
class Client {
  constructor() {
    this.cookie = '';
  }

  async request(urlPath, { method = 'GET', json, body, redirect = 'manual', headers = {} } = {}) {
    const init = { method, redirect, headers: { ...headers } };
    if (this.cookie) init.headers.Cookie = this.cookie;
    if (json !== undefined) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(json);
    } else if (body !== undefined) {
      init.body = body;
    }
    const res = await fetch(`${baseUrl}${urlPath}`, init);
    const setCookie = res.headers.getSetCookie();
    if (setCookie.length) {
      this.cookie = setCookie.map((c) => c.split(';')[0]).join('; ');
    }
    return res;
  }

  async json(urlPath, options) {
    const res = await this.request(urlPath, options);
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  }

  async login({ email, password }) {
    const { status } = await this.json('/services/authservice/api/login', { method: 'POST', json: { email, password } });
    assert.equal(status, 200, `login failed for ${email}`);
  }
}

const admin = new Client();
const editor = new Client();
const anon = new Client();

before(async () => {
  storageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cms-test-'));
  const port = await freePort();
  baseUrl = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, [path.join(__dirname, '..', 'app.js')], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      PORT: String(port),
      CMS_STORAGE_DIR: storageDir,
      CMS_BACKGROUND_INTERVAL_MS: '300',
      DEFAULT_ADMIN_PASSWORD: ADMIN.password,
      NODE_ENV: 'test'
    },
    stdio: ['ignore', 'ignore', 'pipe']
  });
  let stderr = '';
  server.stderr.on('data', (chunk) => { stderr += chunk; });

  const deadline = Date.now() + 20000;
  for (;;) {
    try {
      await fetch(`${baseUrl}/`);
      break;
    } catch (error) {
      if (Date.now() > deadline || server.exitCode !== null) {
        throw new Error(`CMS did not start: ${stderr}`);
      }
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  await admin.login(ADMIN);
  const created = await admin.json('/services/authservice/api/users', {
    method: 'POST',
    json: { email: EDITOR.email, password: EDITOR.password, fullName: EDITOR.fullName }
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  await editor.login(EDITOR);
});

after(async () => {
  if (server && server.exitCode === null) {
    const exited = new Promise((resolve) => server.once('exit', resolve));
    server.kill('SIGTERM');
    await exited;
  }
  fs.rmSync(storageDir, { recursive: true, force: true });
});

const createSite = async (client, name, slug) => {
  const res = await client.json(`${API}/sites`, { method: 'POST', json: { name, slug } });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.site;
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test('signed-out visitors are sent to sign in', async () => {
  const api = await anon.json(`${API}/sites`);
  assert.equal(api.status, 401);

  const screen = await anon.request('/applications/cms/');
  assert.equal(screen.status, 302);
  assert.match(screen.headers.get('location'), /^\/services\/authservice\/views\/login\.html\?returnUrl=/);

  const bare = await anon.request('/applications/cms');
  assert.equal(bare.headers.get('location'), '/applications/cms/');
});

test('creating a site makes a home page and rejects duplicate slugs', async () => {
  const site = await createSite(admin, 'Corner Bakery', 'corner-bakery');
  assert.equal(site.role, 'owner');
  assert.ok(site.homePageId);
  assert.equal(site.online, false);

  const pages = await admin.json(`${API}/sites/${site.id}/pages`);
  assert.equal(pages.body.pages.length, 1);
  assert.equal(pages.body.pages[0].slug, 'home');
  assert.equal(pages.body.pages[0].status, 'draft');

  const duplicate = await admin.json(`${API}/sites`, { method: 'POST', json: { name: 'Other', slug: 'corner-bakery' } });
  assert.equal(duplicate.status, 409);

  const derived = await createSite(admin, 'Ünïcode Café!', undefined);
  assert.equal(derived.slug, 'unicode-cafe');
});

test('page content is sanitised on save', async () => {
  const site = await createSite(admin, 'Sanitise', 'sanitise');
  const dirty = [
    '<h2 class="ql-align-center evil">Title</h2>',
    '<p onclick="steal()">Hello <strong>world</strong><script>alert(1)</script></p>',
    '<p><a href="javascript:alert(1)">bad</a> <a href="https://example.com" target="_blank">good</a></p>',
    '<img src="/applications/cms/media/0b6c2f9e-1111-2222-3333-444455556666" alt="ok">',
    '<img src="/etc/passwd"><img src="data:image/png;base64,AAAA">',
    '<iframe class="ql-video" src="https://www.youtube.com/embed/abc"></iframe>',
    '<iframe src="https://evil.example/embed"></iframe>',
    '<p style="color: #ff0000; position: fixed">red</p>'
  ].join('');

  const res = await admin.json(`${API}/sites/${site.id}/pages/${site.homePageId}`, { method: 'PUT', json: { content: dirty } });
  assert.equal(res.status, 200);
  const html = res.body.page.content;

  assert.match(html, /<h2 class="ql-align-center">Title<\/h2>/);
  assert.match(html, /<strong>world<\/strong>/);
  assert.doesNotMatch(html, /script|onclick|javascript:|evil|passwd|data:image|position/);
  assert.match(html, /<a href="https:\/\/example.com" target="_blank" rel="noopener noreferrer">good<\/a>/);
  assert.match(html, /<img src="\/applications\/cms\/media\/0b6c2f9e-1111-2222-3333-444455556666"/);
  assert.match(html, /<iframe class="ql-video" src="https:\/\/www.youtube.com\/embed\/abc">/);
  assert.match(html, /style="color:#ff0000"/);
});

test('draft, publish, edit and version history', async () => {
  const site = await createSite(admin, 'Versions', 'versions');
  const pagePath = `${API}/sites/${site.id}/pages/${site.homePageId}`;

  await admin.json(pagePath, { method: 'PUT', json: { content: '<p>First</p>' } });
  let res = await admin.json(`${pagePath}/publish`, { method: 'POST' });
  assert.equal(res.body.page.status, 'published');

  res = await admin.json(pagePath, { method: 'PUT', json: { content: '<p>Second</p>', autosave: true } });
  assert.equal(res.body.page.status, 'changed');
  assert.equal(res.body.page.published.content, '<p>First</p>');

  // Saving identical content does not add a version.
  await admin.json(pagePath, { method: 'PUT', json: { content: '<p>Second</p>' } });

  const versions = (await admin.json(`${pagePath}/versions`)).body.versions;
  assert.deepEqual(versions.map((v) => v.reason), ['autosave', 'publish', 'save']);
  assert.equal(versions[0].content, undefined, 'list omits content');

  const first = versions.find((v) => v.reason === 'publish');
  const one = await admin.json(`${pagePath}/versions/${first.id}`);
  assert.equal(one.body.version.content, '<p>First</p>');

  res = await admin.json(`${pagePath}/versions/${first.id}/restore`, { method: 'POST' });
  assert.equal(res.body.page.content, '<p>First</p>');
  assert.equal(res.body.page.status, 'published');

  res = await admin.json(`${pagePath}/unpublish`, { method: 'POST' });
  assert.equal(res.body.page.status, 'draft');
});

test('page hierarchy, slugs and ordering rules', async () => {
  const site = await createSite(admin, 'Tree', 'tree');
  const pagesPath = `${API}/sites/${site.id}/pages`;
  const about = (await admin.json(pagesPath, { method: 'POST', json: { title: 'About Us' } })).body.page;
  assert.equal(about.slug, 'about-us');
  const about2 = (await admin.json(pagesPath, { method: 'POST', json: { title: 'About Us' } })).body.page;
  assert.equal(about2.slug, 'about-us-2');

  const team = (await admin.json(pagesPath, { method: 'POST', json: { title: 'Team', parentPageId: about.id } })).body.page;
  assert.equal(team.parentPageId, about.id);

  const tooDeep = await admin.json(pagesPath, { method: 'POST', json: { title: 'Deep', parentPageId: team.id } });
  assert.equal(tooDeep.status, 400);

  const parentWithChildren = await admin.json(`${pagesPath}/${about.id}`, { method: 'PUT', json: { parentPageId: about2.id } });
  assert.equal(parentWithChildren.status, 400);

  const slugClash = await admin.json(`${pagesPath}/${about2.id}`, { method: 'PUT', json: { slug: 'about-us' } });
  assert.equal(slugClash.status, 409);

  const badOrder = await admin.json(`${pagesPath}/order`, { method: 'PUT', json: { pageIds: [about.id] } });
  assert.equal(badOrder.status, 400);

  const ids = [team.id, about2.id, about.id, site.homePageId];
  const ordered = await admin.json(`${pagesPath}/order`, { method: 'PUT', json: { pageIds: ids } });
  assert.deepEqual(ordered.body.pages.map((p) => p.id), ids);

  const deleteHome = await admin.json(`${pagesPath}/${site.homePageId}`, { method: 'DELETE' });
  assert.equal(deleteHome.status, 400);

  const deleted = await admin.request(`${pagesPath}/${about.id}`, { method: 'DELETE' });
  assert.equal(deleted.status, 204);
  const orphan = await admin.json(`${pagesPath}/${team.id}`);
  assert.equal(orphan.body.page.parentPageId, null);
});

test('public site rendering, sitemap, preview and page views', async () => {
  const site = await createSite(admin, 'Public Site', 'public-site');
  const pagesPath = `${API}/sites/${site.id}/pages`;
  await admin.json(`${pagesPath}/${site.homePageId}`, {
    method: 'PUT',
    json: { content: '<p>Welcome home</p>', seo: { title: 'Best Bread', description: 'Fresh daily' } }
  });
  await admin.json(`${pagesPath}/${site.homePageId}/publish`, { method: 'POST' });
  const menu = (await admin.json(pagesPath, { method: 'POST', json: { title: 'Menu' } })).body.page;
  await admin.json(`${pagesPath}/${menu.id}`, { method: 'PUT', json: { content: '<p>Draft menu</p>' } });

  assert.equal((await anon.request('/sites/public-site/')).status, 404, 'offline site is hidden');

  await admin.json(`${API}/sites/${site.id}/online`, { method: 'POST', json: { online: true } });

  const noSlash = await anon.request('/sites/public-site');
  assert.equal(noSlash.status, 301);
  assert.equal(noSlash.headers.get('location'), '/sites/public-site/');

  const home = await anon.request('/sites/public-site/');
  assert.equal(home.status, 200);
  assert.match(home.headers.get('content-security-policy'), /script-src 'self' https:\/\/cdn.jsdelivr.net/);
  const html = await home.text();
  assert.match(html, /<title>Best Bread<\/title>/);
  assert.match(html, /<meta name="description" content="Fresh daily">/);
  assert.match(html, /Welcome home/);
  assert.doesNotMatch(html, /Menu/, 'unpublished pages stay out of the nav');

  assert.equal((await anon.request('/sites/public-site/menu')).status, 404, 'draft page is hidden');
  assert.equal((await anon.request('/sites/public-site/home')).headers.get('location'), '/sites/public-site/');

  const previewAnon = await anon.request(`/applications/cms/preview/${site.id}/${menu.id}`);
  assert.equal(previewAnon.status, 302);
  const preview = await admin.request(`/applications/cms/preview/${site.id}/${menu.id}`);
  assert.equal(preview.status, 200);
  assert.match(await preview.text(), /Draft menu/);

  await admin.json(`${pagesPath}/${menu.id}/publish`, { method: 'POST' });
  const menuPage = await anon.request('/sites/public-site/menu');
  assert.equal(menuPage.status, 200);
  assert.match(await menuPage.text(), /Draft menu/);

  const sitemap = await (await anon.request('/sites/public-site/sitemap.xml')).text();
  assert.match(sitemap, /<loc>http:\/\/127.0.0.1:\d+\/sites\/public-site\/<\/loc>/);
  assert.match(sitemap, /\/sites\/public-site\/menu<\/loc>/);

  const sites = (await admin.json(`${API}/sites`)).body.sites;
  const listed = sites.find((s) => s.id === site.id);
  assert.equal(listed.viewsLast7Days, 2);
  assert.equal(listed.pageCount, 2);
});

test('scheduled pages publish when their time comes', async () => {
  const site = await createSite(admin, 'Scheduled', 'scheduled');
  const pagePath = `${API}/sites/${site.id}/pages/${site.homePageId}`;
  const when = new Date(Date.now() + 500).toISOString();
  const res = await admin.json(pagePath, { method: 'PUT', json: { content: '<p>Later</p>', scheduledAt: when } });
  assert.equal(res.body.page.status, 'scheduled');

  const past = await admin.json(pagePath, { method: 'PUT', json: { scheduledAt: '2000-01-01T00:00:00Z' } });
  assert.equal(past.status, 400);

  await sleep(1500);
  const page = (await admin.json(pagePath)).body.page;
  assert.equal(page.status, 'published');
  assert.equal(page.published.content, '<p>Later</p>');
  assert.equal(page.scheduledAt, null);
});

test('media upload checks file contents and serves files publicly', async () => {
  const site = await createSite(admin, 'Media', 'media');
  const mediaPath = `${API}/sites/${site.id}/media`;

  const good = new FormData();
  good.append('file', new Blob([PNG_BYTES], { type: 'image/png' }), 'dot.png');
  const uploaded = await admin.json(mediaPath, { method: 'POST', body: good });
  assert.equal(uploaded.status, 201, JSON.stringify(uploaded.body));
  const media = uploaded.body.media;
  assert.equal(media.mimeType, 'image/png');

  const file = await anon.request(media.url);
  assert.equal(file.status, 200);
  assert.equal(file.headers.get('content-type'), 'image/png');
  assert.equal(file.headers.get('x-content-type-options'), 'nosniff');
  assert.deepEqual(Buffer.from(await file.arrayBuffer()), PNG_BYTES);

  const fake = new FormData();
  fake.append('file', new Blob(['<svg onload=alert(1)>'], { type: 'image/png' }), 'evil.png');
  assert.equal((await admin.json(mediaPath, { method: 'POST', body: fake })).status, 400);

  const logo = await admin.json(`${API}/sites/${site.id}`, { method: 'PUT', json: { settings: { logoMediaId: media.id } } });
  assert.equal(logo.body.site.settings.logoMediaId, media.id);

  assert.equal((await admin.request(`${mediaPath}/${media.id}`, { method: 'DELETE' })).status, 204);
  assert.equal((await anon.request(media.url)).status, 404);
  const after = await admin.json(`${API}/sites/${site.id}`);
  assert.equal(after.body.site.settings.logoMediaId, null);
});

test('site settings are validated', async () => {
  const site = await createSite(admin, 'Settings', 'settings');
  const sitePath = `${API}/sites/${site.id}`;
  assert.equal((await admin.json(sitePath, { method: 'PUT', json: { settings: { primaryColor: 'red;}' } } })).status, 400);
  assert.equal((await admin.json(sitePath, { method: 'PUT', json: { settings: { bodyFont: 'comic-sans' } } })).status, 400);
  const ok = await admin.json(sitePath, { method: 'PUT', json: { settings: { primaryColor: '#AA3300', headingFont: 'lora' } } });
  assert.equal(ok.body.site.settings.primaryColor, '#aa3300');
  assert.equal(ok.body.site.settings.headingFont, 'lora');
});

test('editors can edit pages but not manage the site', async () => {
  const site = await createSite(admin, 'Team Site', 'team-site');
  const sitePath = `${API}/sites/${site.id}`;

  assert.equal((await editor.json(sitePath)).status, 404, 'non-members cannot see the site');
  assert.ok(!(await editor.json(`${API}/sites`)).body.sites.some((s) => s.id === site.id));

  const added = await admin.json(`${sitePath}/members`, { method: 'POST', json: { email: 'Editor@Example.com' } });
  assert.deepEqual(added.body.site.members, [{ email: 'editor@example.com', role: 'editor' }]);

  const visible = (await editor.json(`${API}/sites`)).body.sites.find((s) => s.id === site.id);
  assert.equal(visible.role, 'editor');

  const edit = await editor.json(`${sitePath}/pages/${site.homePageId}`, { method: 'PUT', json: { content: '<p>Edited</p>' } });
  assert.equal(edit.status, 200);
  assert.equal(edit.body.page.updatedBy, 'editor@example.com');
  assert.equal((await editor.json(`${sitePath}/pages/${site.homePageId}/publish`, { method: 'POST' })).status, 200);

  assert.equal((await editor.json(sitePath, { method: 'PUT', json: { name: 'Hijacked' } })).status, 403);
  assert.equal((await editor.json(`${sitePath}/online`, { method: 'POST', json: { online: true } })).status, 403);
  assert.equal((await editor.json(`${sitePath}/members`, { method: 'POST', json: { email: 'x@example.com' } })).status, 403);
  assert.equal((await editor.request(sitePath, { method: 'DELETE' })).status, 403);

  // An editor's own site is theirs alone.
  const own = await createSite(editor, 'Editor Site', 'editor-site');
  assert.equal(own.ownerEmail, 'editor@example.com');

  await admin.json(`${sitePath}/members/editor%40example.com`, { method: 'DELETE' });
  assert.equal((await editor.json(sitePath)).status, 404);
});

test('deleting a site removes it and its public pages', async () => {
  const site = await createSite(admin, 'Short Lived', 'short-lived');
  await admin.json(`${API}/sites/${site.id}/pages/${site.homePageId}/publish`, { method: 'POST' });
  await admin.json(`${API}/sites/${site.id}/online`, { method: 'POST', json: { online: true } });
  assert.equal((await anon.request('/sites/short-lived/')).status, 200);

  assert.equal((await admin.request(`${API}/sites/${site.id}`, { method: 'DELETE' })).status, 204);
  assert.equal((await anon.request('/sites/short-lived/')).status, 404);
  assert.equal((await admin.json(`${API}/sites/${site.id}`)).status, 404);
});

test('documentation endpoints list published docs', async () => {
  const list = await anon.json(`${API}/documentation/list`);
  assert.ok(list.body.docs.some((d) => d.id === 'quickstart'));
  assert.equal((await anon.json(`${API}/documentation/..%2Fpackage`)).status, 404);
});
