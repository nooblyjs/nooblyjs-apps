# NooblyJS Cloud (hero-co)

A Heroku/Render-style PaaS on nooblyjs-core and the NooblyJS accelerators. Read these first, in this order:

1. `.claude/steering/product.md`: what we build, for whom, the screens (§5) and the copy rules.
2. `.claude/steering/stack.md`: how it is built: ESM, Node ≥ 22.12, Express 5, no build step, the theme, the CSP.
3. `.claude/steering/roadmap.md`: what is next. Tick a box only when its test passes.

The UI spec and mock-ups live in `.claude/steering/ui/`.

## Run

```bash
npm install
npm start                 # http://localhost:11010: sign up at /, sign in at /services/authservice/views/login.html (or /dev/login in development)
npm test                  # node:test, offline, on the mock cloud
npm run test:ui:install   # once: Playwright Chromium (needs system libraries: sudo npx playwright install-deps chromium)
npm run test:ui           # Playwright, desktop + phone
```

Local network region (infra spec 8.9): in development `npm start` also runs the infrastructure accelerator's agent
against this machine's Docker (`HERO_LOCAL_AGENT=fork|mock|off`; tests use `mock`). A Local network service builds on
this machine and answers at `<base URL>/<workspace>/<service>/` (`src/routes/proxy.js`: none of our cookies go to the
app, its cookies are dropped, its pages are sandboxed). The start-up admin gets a workspace of their own.

Development people (created on first start outside production; password `development-only-1`): `stevie` (workspace
exclusivity-life), `amara` (amara-labs), `ops-platform` (operator, infra Owner), `ops-support` (operator, infra Viewer).
Tests call as a person with the `X-Dev-Person` header (id or email), or sign in with a cookie jar (`test/helpers.js`).
"Continue with GitHub" uses the mock GitHub at `/dev/github` unless `GITHUB_CLIENT_ID` is set. Account emails land in
the customers accelerator's console outbox (`hero.accelerators.mounted.customers.marketing.channels.email.outbox`).

## Layout

- `app.js`: entry (`--seed [--reset]` seeds the infrastructure accelerator).
- `src/app.js`: `createApp()`: core, CSP, sessions, gates, accelerators, API, pages. Tests start it on port 0.
- `src/platform/`: `accounts.js` (people, workspaces, members, invitations, tokens on core dataService), `auth.js`
  (sign-up/in, verify, reset, GitHub, the mock GitHub), `session.js` (sessions, CSRF, gates, dev sign-in),
  `customers-link.js` (customer, organisation, consent, account emails), `host.js` (the infrastructure accelerator's
  host contract), `accelerators.js` (customers at `/admin`, payments when built, infrastructure at `/infrastructure`),
  `people.js`, `realtime.js`.
- `src/routes/`: `api.js` (`/api/v1`), `workspaces.js` (`/api/v1/workspaces/:workspace/...`, invitations), `pages.js`
  (page URLs answered with `public/index.html`).
- `public/`: `css/styles.css` (verbatim copy of `nooblyjs/styling/styles.css`; never edit it), `css/hero-co.css`
  (everything else, theme tokens only), `js/` (native ES modules: router, api, sse, charts, components, shell, pages).

## Rules

- No inline `style=""`, `<style>`, inline scripts or `on*=` handlers: core's CSP has no `unsafe-inline`. Set dynamic
  sizes through the CSSOM (`data-pct` + `applySizes()`). `test/app.test.js` checks this.
- Escape everything with `html```; numbers carry units and limits; statuses are words as well as colours.
- The only sign-in screen is nooblyjs-core's `/services/authservice/views/login.html` (with `?returnUrl=`); this app
  answers its API in `auth.js` (`login` router). Never build another sign-in page.
- Another workspace is a 404, never a 403. Operator-only routes are a 404 for customers. A new workspace route goes in
  `src/routes/workspaces.js` (behind `requireWorkspace`): `test/isolation.test.js` walks that router.
- Accelerators are mounted with `mount(app, eventEmitter, serviceRegistry, options)` and shut down in reverse.
- Temporary files go in `.temp/` (git-ignored); data in `DATA_DIR` (default `.application/`).
