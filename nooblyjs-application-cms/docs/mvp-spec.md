# CMS MVP Specification

This is the build spec for the first working version of the NooblyJS CMS. It narrows the [PRD](prd-cms-platform.md) to what one service can deliver on NooblyJS Core. Where this spec and the planning docs disagree, this spec wins.

## Scope

**In:** signing in, multi-site management, a WYSIWYG page editor, page hierarchy and navigation, draft/publish/scheduled publishing, version history, a media library, site theming, SEO fields, site members, public site rendering with a sitemap, and basic page-view counts.

**Out:** e-commerce, drag-and-drop layout building, templates, real-time co-editing, comments, email, custom domains/SSL/CDN, form builder, AI features.

## Stack

- Node.js and Express, wired like the sibling blog app: `index.js` registers `src/routes` and `src/views`.
- Bootstrap 5 and plain JavaScript in the browser. No build step.
- WYSIWYG editing with [Quill 2](https://quilljs.com) from jsDelivr.
- Server-side HTML sanitising with `sanitize-html`.

## NooblyJS Core Services

| Need | Service | Provider |
|------|---------|----------|
| Accounts, sign-in, sessions | `authservice` | `file` |
| Sites, pages, versions, media metadata, view counts | `dataService` | `file` |
| Uploaded media bytes | `filing` | `local` (`.noobly-core/media`) |
| Live page-view metrics | `measuring` | `memory` |
| Logging | `logger` | `file` |

All storage lives under `.noobly-core/` by default. Set `CMS_STORAGE_DIR` to move it (the tests use this).

The core `scheduling` service runs worker scripts in separate threads, so it can't safely update the in-process data store. Scheduled publishing therefore runs on a 60-second in-process timer.

## Users and Permissions

Accounts come from the NooblyJS auth service. Direct registration is disabled there: an admin creates users, or invites them, at `/services/authservice/`. The CMS uses the core login page (`/services/authservice/views/login.html`) and passport session.

| Who | Can |
|-----|-----|
| Any signed-in user | Create sites (becomes the owner), see sites they own or are a member of |
| Site **editor** (member) | Edit, publish and delete pages; manage media; preview |
| Site **owner** | Everything editors can, plus site settings, members, taking the site online/offline, deleting the site |
| Auth-service **admin** role | Owner rights on every site |

## Data Model

Each record is stored in a `dataService` container. The `id` is the key the data service generated, copied into the record.

**`cms_sites`**

```js
{
  id, name, slug,            // slug is unique across all sites; used in the public URL
  description,
  ownerEmail,
  members: [{ email, role: 'editor' }],
  online: false,             // public URLs return 404 while false
  homePageId,
  settings: {
    primaryColor: '#0d6efd', backgroundColor: '#ffffff', textColor: '#212529',
    headingFont: 'system', bodyFont: 'system',
    logoMediaId: null, footerText: ''
  },
  createdAt, updatedAt
}
```

**`cms_pages`**

```js
{
  id, siteId,
  title, slug,               // slug is unique within the site
  parentPageId: null,        // one level of nesting, shown as a nav dropdown
  order: 0,
  showInNav: true,
  content: '<p>…</p>',       // draft HTML, sanitised on save
  seo: { title: '', description: '', ogImageMediaId: null },
  published: null | { title, content, seo, publishedAt, publishedBy },
  scheduledAt: null,         // ISO time; publishes the draft when reached
  createdAt, updatedAt, updatedBy
}
```

A page's status comes from these fields:
- `draft`: never published.
- `published`: the live copy matches the draft.
- `changed`: published, but the draft has edits since.
- `scheduled`: `scheduledAt` is set.

Slug, order, parent and nav visibility take effect on the live site straight away. Title, content and SEO go live only when the page is published.

**`cms_versions`**

`{ id, pageId, siteId, title, content, seo, reason: 'save'|'autosave'|'publish'|'restore', savedAt, savedBy }`

A version is written whenever saving changes the title, content or SEO. The CMS keeps the newest 50 per page.

**`cms_media`**

`{ id, siteId, filename, originalName, mimeType, size, uploadedAt, uploadedBy }`

The bytes are stored at `<siteId>/<id><ext>` through the filing service. Allowed types are PNG, JPEG, GIF, WebP and PDF, up to 10 MB each. SVG is refused because it can carry script.

**`cms_page_views`**

`{ id, siteId, day: 'YYYY-MM-DD', views: { [pageId]: count } }`

View counts are held in memory and written to storage every 60 seconds.

## HTML Sanitising

Page HTML is sanitised when it is saved. Only these are allowed:

- **Tags:** `p br h1–h6 strong b em i u s sub sup a ul ol li blockquote pre code span img hr iframe`.
- **Attributes:** `class` values starting with `ql-`, plus inline `color`, `background-color` and `text-align` styles.
- **Links:** `http`, `https`, `mailto` and `tel` URLs only.
- **Images:** `http`/`https` URLs or this app's own media URLs.
- **Iframes:** YouTube and Vimeo only.

Public pages are also sent with a Content-Security-Policy that only allows scripts from jsDelivr.

## URLs

### CMS screens (sign-in required)

| Path | Screen |
|------|--------|
| `/applications/cms/` | Dashboard: your sites, create a site |
| `/applications/cms/sites/:siteId` | Site: pages, media, settings, members tabs |
| `/applications/cms/sites/:siteId/pages/:pageId` | Page editor |
| `/applications/cms/preview/:siteId/:pageId` | Draft preview, rendered like the live page |

### JSON API (`/applications/cms/api`, sign-in required)

Errors return `{ error: { code, message } }` with a 4xx/5xx status.

| Method & path | Purpose | Minimum role |
|---------------|---------|--------------|
| `GET /me` | Current user | — |
| `GET /sites` | Sites you can access, with page counts and 7-day views | — |
| `POST /sites` | Create a site `{ name, slug?, description? }`; also creates a Home page | — |
| `GET /sites/:siteId` | Site, with your role | editor |
| `PUT /sites/:siteId` | Update name, slug, description, settings | owner |
| `POST /sites/:siteId/online` | `{ online: true|false }` | owner |
| `DELETE /sites/:siteId` | Delete the site, its pages, versions, media | owner |
| `POST /sites/:siteId/members` | Add an editor `{ email }` | owner |
| `DELETE /sites/:siteId/members/:email` | Remove a member | owner |
| `GET /sites/:siteId/pages` | Pages (without content), with status | editor |
| `POST /sites/:siteId/pages` | Create `{ title, slug?, parentPageId? }` | editor |
| `PUT /sites/:siteId/pages/order` | Reorder `{ pageIds: [...] }` | editor |
| `GET /sites/:siteId/pages/:pageId` | Page with content | editor |
| `PUT /sites/:siteId/pages/:pageId` | Save the draft (any of title, slug, parentPageId, showInNav, content, seo, scheduledAt), plus `autosave: true` for autosaves | editor |
| `DELETE /sites/:siteId/pages/:pageId` | Delete (not the home page) | editor |
| `POST /sites/:siteId/pages/:pageId/home` | Make this the home page | owner |
| `POST /sites/:siteId/pages/:pageId/publish` | Publish the current draft | editor |
| `POST /sites/:siteId/pages/:pageId/unpublish` | Take the page off the live site | editor |
| `GET /sites/:siteId/pages/:pageId/versions` | Version list (no content) | editor |
| `GET /sites/:siteId/pages/:pageId/versions/:versionId` | One version with content | editor |
| `POST /sites/:siteId/pages/:pageId/versions/:versionId/restore` | Copy a version into the draft | editor |
| `GET /sites/:siteId/media` | Media list | editor |
| `POST /sites/:siteId/media` | Upload (multipart field `file`) | editor |
| `DELETE /sites/:siteId/media/:mediaId` | Delete media | editor |

### Public

| Path | Serves |
|------|--------|
| `/sites/:siteSlug/` | Home page |
| `/sites/:siteSlug/:pageSlug` | A published page |
| `/sites/:siteSlug/sitemap.xml` | Sitemap of published pages |
| `/applications/cms/media/:mediaId` | Media file (IDs are random UUIDs) |

A site that is offline returns 404, and so does a page that has never been published.

## Screens

- **Dashboard:** a card for each site, showing its status, page count and 7-day views. A button opens "New site", which fills in the slug from the name as you type. The header shows who is signed in and a Sign out button.
- **Site screen:**
  - **Pages:** a table with title, slug, status, last updated and nav visibility. Rows can be moved up and down; children are indented under their parent. It has "New page", "Set as home" and delete actions.
  - **Media:** a grid with upload, copy URL and delete.
  - **Settings:** name, slug, description, colours, fonts, logo and footer text. It also has the Online/Offline switch and a Danger zone for deleting the site.
  - **Members:** add or remove editors by email.
- **Page editor:**
  - Quill toolbar: headings, bold, italic, underline, strike, colour, lists, alignment, quote, code, link, image and video. The image button opens the site's media picker, where you can also upload.
  - Side panel: title, slug, parent page, nav visibility, SEO title/description/image, and a schedule date-time.
  - Buttons: Save, Preview, Publish/Unpublish and Versions. The Versions dialog lets you preview a version and restore it.
  - It autosaves every 30 seconds when there are changes, saves on Ctrl/Cmd+S, and warns before leaving with unsaved changes.

## Public Site Rendering

Pages are rendered on the server from one template:
- Bootstrap 5.
- The site's colours as CSS variables, and the chosen fonts loaded from Google Fonts.
- A navbar with the logo or site name, and published pages in order. Child pages appear as dropdowns.
- The page content, then the footer text.
- `<title>`, a meta description and Open Graph tags from the page's SEO fields, falling back to the page title and site description.

Fonts are picked from a fixed list: system, Inter, Roboto, Open Sans, Lora, Merriweather and Playfair Display.

## Tests

`npm test` runs `node --test`. The tests start the app on a spare port with a temporary storage folder, sign in as the default admin (password set through `DEFAULT_ADMIN_PASSWORD`), and cover:
- Creating sites and pages, saving, publishing and versions.
- Permissions.
- Sanitising.
- Public rendering and the sitemap.
- Media upload.
