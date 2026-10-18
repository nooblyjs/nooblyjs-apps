# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Status

NooblyJS CMS is a microservice meant to expose a multi-site CMS on top of NooblyJS Core. It lives in the `nooblyjs-apps` monorepo alongside `nooblyjs-application-blog` (port 3003) and `nooblyjs-application-wiki`, and follows the same bootstrap/factory pattern as those apps.

**Most of this app has not been built yet.** The only server code is `app.js` and `index.js`. The planning docs in `docs/` (`prd-cms-platform.md`, `implementation-roadmap.md`, `development-todo.md`) describe a CMS with sites, pages, media and publishing that doesn't exist yet. Treat them as a spec. Those docs propose a React/Tailwind front end, but this app and its sibling apps use Bootstrap 5 with plain JavaScript. `docs/index.md` explains how the docs are organised.

There are no tests, linter or build step.

## Commands

```bash
npm install      # nooblyjs-core is a relative dep: ../../nooblyjs-core (sibling of the monorepo root)
npm run dev      # node app.js — listens on PORT or 3004
npm run kill     # kill whatever is on port 3004
```

npm installs `nooblyjs-core` as a copied directory in `node_modules/`, not a symlink. After changing `../../nooblyjs-core`, run `npm install` again to pick up the change.

## Architecture

- **`app.js`** (entry point): creates the Express app and HTTP server, then calls `serviceRegistry.initialize(app, eventEmitter, options)` with `options.logDir`/`options.dataDir` under `./.noobly-core/` (gitignored). It instantiates the core services as singletons (`logger('file')`, `cache`, `dataService`, `queue`, `scheduling`, `searching`, `measuring`, `notifying`, `working`, `workflow` all `'memory'`, `filing('local')`, `authservice('file')`). It serves `public/` at `/`, `docs/` at `/docs` and the README at `/readme`, then mounts the app with `require('.')(app, server, eventEmitter, serviceRegistry, options)` and starts listening with `server.listen`.
- **`index.js`** (application factory): register CMS routes and views here, the same way `../nooblyjs-application-blog/index.js` wires `src/routes` and `src/views`. App routes live under `/applications/cms/...`, and JSON APIs go under `/applications/cms/api/...`. For now it only serves `/applications/cms/README.md` and the documentation API (`/applications/cms/api/documentation/list` and `/:docId`). That API reads `docs/published.json`.
- **`public/index.html`**: the static landing page. It loads the published docs from the documentation API and renders them with a small built-in markdown converter.
- **NooblyJS Core**: calling `serviceRegistry.<service>(provider)` with the same service and provider always returns the same singleton, and dependencies are injected automatically. Each service exposes REST and UI routes under `/services/{service}/api/*`; these require auth and return 401 when unauthenticated. `docs/nooblyjs-core-usage.md` is the reference for service APIs and provider options.
- **Auth bootstrap**: on first run, `authservice('file')` writes `users.json`, `roles.json` and `INITIAL_ADMIN_PASSWORD.txt` to `./.noobly-core/data/`.
