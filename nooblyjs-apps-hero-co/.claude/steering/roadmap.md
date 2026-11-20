---
inclusion: always
type: Roadmap
title: NooblyJS Cloud — Roadmap
description: The build order for NooblyJS Cloud, phase by phase, with exit checks and the work it needs from nooblyjs-core and the three accelerators.
tags: [hero-co, nooblyjs-cloud, steering, roadmap]
---

# NooblyJS Cloud — Roadmap

> **Status:** Draft v1 · 2026-11-19, revised the same day: theme at `nooblyjs/styling`, `mount()` for every
> accelerator, platform hosting moved into the infrastructure accelerator's phase 8, billing on the new payments
> accelerator. What and why: `product.md`. With what: `stack.md` (§ numbers below point there).
> **Tick a box in the same change as the work.** A phase is done when its **exit check** passes.

Ground rules for every phase:

- **Mock first.** Everything works offline on the infrastructure accelerator's mock cloud and the payments
  accelerator's mock provider (seed story, tests, screens) before any real cloud or provider is involved.
- A screen is done when it matches its mock-up in `.claude/steering/ui/` at desktop and phone width, uses the theme's
  tokens and the style guide's **Never** list, is keyboard and screen-reader usable, and every number comes from records.
- `npm test` stays green and offline. Every new API route gets a permission test and a cross-workspace isolation test.
- Work that belongs in **nooblyjs-core** or an **accelerator** is done there, on that repo's own roadmap, and only
  ticked here when it lands. Those items are marked **[core]**, **[infra n.n]** (`nooblyjs-accl/.claude/steering/
  infrastructure-roadmap.md`, specs in `nooblyjs-accl-infrastructure/.claude/specs/`), **[pay n.n]**
  (`nooblyjs-accel-payments/.claude/steering/payments-roadmap.md`) or **[cx]**.

## Where we start (2026-11-19)

- This repo has a blank `package.json` (CommonJS, no scripts) and the UI steering in `.claude/steering/ui/`.
- **Theme:** `nooblyjs/styling/styles.css`, already copied verbatim by core and the customers accelerator.
- **nooblyjs-core 2.0.0** is ready: every service we need, CSP helpers that allow jsDelivr and Google Fonts. No GitHub
  sign-in provider (use `passport`).
- **Infrastructure accelerator 0.2.0**: phase 2 on the mock cloud; entry point is now `mount()` (its 0.6a, done
  2026-11-19, 122 tests green on Express 4 and 5). Endpoints (3), buckets (4), databases (5), deploy from Git (6) and
  **platform hosting (8.1–8.8)** are specified, not built.
- **Customers accelerator 0.3.0**: customer and marketing modules complete; support is a placeholder.
- **Payments accelerator**: steering, spec and roadmap written 2026-11-19; no code.

### Dependency map

| NooblyJS Cloud phase | Needs first |
| --- | --- |
| 0 Skeleton | — |
| 1 Accounts | [cx] (done) · [pay 0–1] for the billing account on sign-up (can follow in Phase 7) |
| 2 Create flow (simulated) | [infra 8.1] mock platform API |
| 3 Real runtime | [infra 3, 6, 8.2, 8.3, 8.4] and one real region ([infra 2.8–2.10]) |
| 4 Watch screens | [infra 8.5] |
| 5 Static, Cron, Workflow | [infra 4, 8.8] · core scheduling and workflow |
| 6 Postgres, Key Value | [infra 5, 8.6, 8.7] |
| 7 Billing | [pay 0–3] · [infra 8.5] usage |
| 8 Launch | [pay 5] · [infra 8 exit check] |

---

## Phase 0 — Skeleton and foundations

Goal: the app boots with core and the three accelerators mounted, the theme, the shell and empty pages for every route.

- [x] 0.1 `package.json`: ESM, `engines >= 22.12`, `file:` links to core and the three accelerators, scripts (`start`, `dev`, `seed`, `test`, `test:ui`); `CLAUDE.md` pointing at these three files.
- [x] 0.2 `app.js`: Express 5, one shared `EventEmitter`, `serviceRegistry.initialize(app, eventEmitter, …)`, providers per stack §3.1 (dev), core's CSP helper, `/health/live`.
- [x] 0.3 `src/platform/accelerators.js`: `mount()` customers (`customer`, `marketing`) → payments (`payments`, `billing`, mock provider; stub until [pay 0] lands) → infrastructure (`/infrastructure`, `platform: { enabled: true }`, with the `host` object: auth, `requireRole`, audit, events, store, people, frame); reverse `shutdown()`. Test: all mount on Express 5; a missing capability mounts nothing.
- [x] 0.4 Theme: copy `nooblyjs/styling/styles.css` verbatim to `public/css/styles.css`; load Bootstrap 5.3.3 and Bootstrap Icons 1.11.3 from jsDelivr before it; `public/css/hero-co.css` with JetBrains Mono and the token map of stack §5.
- [x] 0.5 `.nj-` components in `hero-co.css`: status pill, stat tile, meter, option card, stepper, sticky summary, repo row, instance tile, log viewer shell, empty state.
- [x] 0.6 Client: `router.js` (real URLs, deep links), `api.js`, `sse.js`, `charts.js` (area, stacked bar); the app shell (top bar, workspace switcher, sidebar from product §5) with an empty page per route.
- [x] 0.7 Test harness: `node:test` on the mock cloud; Playwright smoke at desktop and phone width with a CSP-violation check.

**Exit check:** `npm start` serves the shell; every route in product §5 renders (deep link + refresh); the operator
can open `/infrastructure` and `/admin/customer/`; `npm test` and `npm run test:ui` green offline. *Done 2026-11-19: payments reported pending until [pay 0] lands.*

## Phase 1 — Accounts, workspaces and the sign-up screen

Goal: a person can sign up and land in their own empty workspace.

- [x] 1.1 Sign-up screen (*Sign up* mock-up): hero, service chips, feature rows, the account card with validation (password ≥ 12 chars with a number).
- [x] 1.2 Email + password sign-up and sign-in on core `authservice`; sessions; verify-email and reset-password flows.
- [x] 1.3 **Continue with GitHub** through `passport-github2` (core's `passport` provider is local-strategy only, so the strategy lives in `src/platform/auth.js`; a mock GitHub at `/dev/github` serves the OAuth flow offline). **[core]** if a reusable GitHub strategy belongs in core.
- [x] 1.4 Domain records on dataService: workspace, membership (Owner/Member), project, environment; created on sign-up.
- [x] 1.5 Customers accelerator link: `customers:upsert` by identity `nooblyjs-cloud:<personId>`, organisation per workspace, consent from the form; welcome and verify-email via `sendTransactional`.
- [x] 1.6 Workspace isolation middleware; isolation test suite started here and extended every phase.
- [x] 1.7 Settings → Members: invite by email, remove, one role.

**Exit check:** sign up with email and with GitHub; each lands in its own workspace with *Production*; the operator
sees the new customer, organisation and consent in the customer 360; a second person cannot reach the first's workspace
by any URL or API call. *Done 2026-11-19 (`test/accounts.test.js`, `members.test.js`, `isolation.test.js`, Playwright).*

Follow-ups found in Phase 1:
- **[core]** a password-policy option on authservice: core's rule (10+ characters with upper, lower, digit and symbol)
  differs from product §3.1, so `createCoreAuth()` replaces the instance's `validatePasswordStrength`.
- **[cx]** a way to send a transactional template without click tracking: verify, reset and invitation links are
  rewritten through the customers accelerator's click tracker, so their one-time tokens are stored in its tracking
  links. The tokens are single-use and short-lived; the store is operator-only.
- Production email: the customers accelerator's SMTP adapter (needs a nodemailer transport) is not wired yet, so
  account emails stay in its console outbox. Needed before a production launch.
- The customers accelerator runs on the memory data provider here, so customer records are lost on restart in
  development; production needs its MongoDB provider (stack §3.1).

## Phase 2 — Service catalogue and the create flow (mock platform)

Goal: the create screens work end to end against the infrastructure accelerator's mock platform API.

- [x] 2.1 **[infra 8.1]** Platform API and workloads on the mock cloud (`services.platform`, tenant labels, deploy events).
- [x] 2.2 Service model and `src/platform/workloads.js` (service → workload spec; plan name → `{ cpu, memoryMb }`). Plan names and prices come from the payments catalogue once [pay 1.2] lands; a local table until then.
- [x] 2.3 **Create a new service** screen: the nine option cards in two groups, copy verbatim, Beta badge, stepper.
- [x] 2.4 **GitHub connection**: install/OAuth, organisations, repo search and list (cached), branches. GitHub page.
- [x] 2.5 **New web service** screen: four fieldsets, live Summary with estimate, Auto-deploy switch, *Deploy web service*; 422 field errors inline.
- [x] 2.6 Env vars and **environment groups**: encrypted at rest, *Add from .env*, link group; Environment groups page.
- [x] 2.7 Deploy records from `infrastructure.deploy.*` events; service page shows build progress.
- [x] 2.8 Seed story (product §9) on top of the accelerator's [infra 8.1.7] tenant seed: `npm run seed [-- --reset]`.

**Exit check:** after `npm run seed`, creating a web service from a seeded repo shows mock build progress and lands on
its service page as *Live*; secrets never appear in API responses; another workspace cannot see the workload.

## Phase 3 — Real runtime (one real region)

Goal: Web, Private and Worker services build from GitHub and run on shared hosts behind `*.nooblyjs.app`.

**First, on local servers (decided 2026-11-20).** Before any cloud, services run on your own Ubuntu servers on the
local network, through the infrastructure accelerator's spec **8.9 Local servers** (an outbound Node 22 agent driving
Docker; LAN addresses, no TLS; live logs like Render's). The first server is this Codespace. hero-co's part:

- [x] 3.0a **[infra 8.9]** Local servers in the accelerator (sites, enrolment, agent, `runtime-local`, telemetry).
- [x] 3.0b Local sites in the region list ("Local network · lan-dev"); `resolveSecrets` hook opening sealed variables at deploy.
- [x] 3.0c Service page: its URL `<base URL>/<workspace>/<service>/` (decided 2026-11-20: path routing on this app's URL, like Render; `src/routes/proxy.js`); live build log and a Logs terminal (search, errors only, pause). Public Git URLs as a source.
- [x] 3.0d Exit check: this Codespace enrolled; a web service created in hero-co builds from a repo, runs as two instances
  and answers on its LAN address; its logs stream live on the service page.
  (Run 2026-11-20 on this Codespace: `twin` from render-examples/express-hello-world, two instances at 1 vCPU / 2 GB,
  read-only, all capabilities dropped; a changed variable rolled both over with 171 of 171 requests answered; the
  agent stopped and started again delivered the lines written meanwhile once each; live stats on the server row.)

The items below then bring the same services to a cloud region behind `*.nooblyjs.app`.

- [ ] 3.1 **[infra 3]** Public endpoints (Caddy, Let's Encrypt).
- [ ] 3.2 **[infra 6]** Deploy from Git (clone with a token, health-check gate).
- [ ] 3.3 **[infra 8.2]** Containers on shared hosts: pools, placement, limits, tenant networks, jobs.
- [ ] 3.4 **[infra 8.3]** Builds (Node 22, Python 3.12, Go 1.23, Dockerfile) and the registry.
- [ ] 3.5 **[infra 8.4]** Ingress, wildcard `*.nooblyjs.app`, custom domains, rolling deploys across hosts.
- [ ] 3.6 **[infra 2.8–2.10]** One cloud adapter and account connection for Johannesburg.
- [ ] 3.7 Operator setup: host pool, builder pool and ingress pool for Johannesburg (through the accelerator's screens); `INFRA_PLATFORM_DOMAIN=nooblyjs.app`.
- [ ] 3.8 Auto-deploy webhook (`/hooks/github`, HMAC, branch filter) → `workloads.deploy()`; *Manual deploy*, *Restart*, *Suspend* buttons.
- [ ] 3.9 Private Services: internal host name shown on the service page; Worker: no URL, no port fields.
- [ ] 3.10 "Region is full" message from `quota` errors on the create flow.
- [ ] 3.11 **Idle sleep [infra 8.4]**: Web and Private services with no requests for 15 minutes scale to zero; the
  ingress holds the next request, wakes the service and forwards it. The service page shows *Sleeping*. Workers, cron
  jobs and static sites never sleep. Plans are a flat price per service for 1 to 10 instances (product.md §11).

**Exit check:** in one real region, deploy a private Node repo as a 2-instance Web Service; reach it on
`https://<name>.nooblyjs.app`; push a commit and watch it roll out with zero failed requests; push a failing health
check and confirm the old version keeps serving; a Worker runs with no URL; a Private Service is reachable from the
workspace's web service and from nowhere else.

## Phase 4 — Dashboard, service detail, metrics and logs

Goal: the two "watch it" screens, with real numbers.

- [ ] 4.1 **[infra 8.5]** Workload telemetry: per-instance metrics and log streaming to the launcher.
- [ ] 4.2 Metric history: `telemetry.subscribe({ onMetrics })` → `measuring` → roll-ups; payloads always `{ value, unit, limit }`.
- [ ] 4.3 Log storage (stack §4.3): live tail over SSE, daily NDJSON in `filing`, retention sweep by plan, search index.
- [ ] 4.4 **Environment dashboard** (*Production dashboard* mock-up): four stat tiles, CPU allocated by service, services list with type-specific meters, recent deploys.
- [ ] 4.5 **Service detail** (*api service* mock-up): header and actions, tabs, Resources chart with metric switcher and range, instance tiles, dark log viewer (live/paused, level filter, search, empty state, retention footer).
- [ ] 4.6 Deploys tab and workspace **Deploys** page; workspace **Metrics** and **Logs** pages.
- [ ] 4.7 Scaling tab: change instance type (no rebuild) and count → `workloads.scale()`.

**Exit check:** the seeded dashboard and service page match their mock-ups with computed numbers; a `console.log`
in a deployed service appears in the live tail in under 3 seconds; CPU on the chart moves when load is applied.

## Phase 5 — Remaining app types: Static Site, Cron Job, Workflow

- [ ] 5.1 **[infra 4, 8.8]** Buckets, static sites and the CDN.
- [ ] 5.2 Static Site form and page: build command, publish directory, bandwidth and cache-hit meters.
- [ ] 5.3 Cron Job: schedule in core `scheduling` firing `workloads.runJob()`; last run, peak memory, next run.
- [ ] 5.4 Workflow: core `workflow` for task definitions, retries and concurrency cap; tasks running and queue meters.
- [ ] 5.5 Create forms and detail pages for each (designs needed).

**Exit check:** the seeded `storefront`, `etl` and `orders` services run for real and show the meters from the
dashboard mock-up.

## Phase 6 — Data services: Postgres and Key Value

Decided 2026-11-19: built in the infrastructure accelerator (specs 8.6 and 8.7), not as containers here.

- [ ] 6.1 **[infra 5]** Databases foundation.
- [ ] 6.2 **[infra 8.6]** Managed Postgres (PITR, replica, HA, per-tenant access).
- [ ] 6.3 **[infra 8.7]** Managed Key Value (Memorystore / ElastiCache for Valkey).
- [ ] 6.4 Create forms, detail pages (storage/memory, connections, backups), *Link to service* → `DATABASE_URL` / `REDIS_URL` as secrets.

**Exit check:** create Postgres and Key Value, link them to the seeded `api`, connect from it, and confirm no other
workspace can reach them.

## Phase 7 — Billing

Built on `nooblyjs-accel-payments`.

- [ ] 7.1 **[pay 0–1]** Payments skeleton, accounts, catalogue, payment methods, `CardForm`.
- [ ] 7.2 **[pay 2]** Subscriptions, usage, rating, invoices, tax.
- [ ] 7.3 **[pay 3]** Collection, dunning, refunds, webhooks, Stripe adapter (or **[pay 4.1]** Paystack first; payments O2).
- [ ] 7.4 Billing account per workspace on sign-up (`ensureAccount`); plan table and meters seeded in the payments catalogue; the Summary's *Estimated / mo* reads its prices.
- [ ] 7.5 Hourly usage hand-off: `services.platform.usage()` **[infra 8.5.5]** → `pay.billing.recordUsage()`.
- [ ] 7.6 Free tier enforcement with the *Add a card* prompt (`CardForm`); `pay.account.delinquent` → suspend after the final dunning attempt, with warnings first.
- [ ] 7.7 **Billing** page: plan, usage this period, next invoice estimate (`BillingSummary`), cards, invoices (PDF).

**Exit check:** a month of seeded usage produces an invoice within 5% of the sum of the Summary estimates shown at
creation; a declined card is retried and the owner is emailed each time; a paid invoice shows on the Billing page.

## Phase 8 — Hardening and launch

- [ ] 8.1 Production providers: MongoDB dataService, Redis queue/cache/sessions; `TRUST_PROXY`; Dockerfile and CI (Node 22 + 24, tests, Playwright, audit).
- [ ] 8.2 Second, third and fourth regions (Frankfurt, Virginia, Singapore): pools and ingress per region.
- [ ] 8.3 Security review: tenant isolation, container hardening, webhook verification, secret handling, rate limits, payments SAQ A scope.
- [ ] 8.4 Dark mode in `hero-co.css` (`data-bs-theme="dark"`); accessibility audit (axe) on every screen.
- [ ] 8.5 Operator runbooks: host drain, region full, failed builds across tenants, failed payments.
- [ ] 8.6 **[pay 5]** Payments v1.0 hardening.

**Exit check:** a stranger signs up, deploys a repo and reads its logs in under 5 minutes, in any of the four regions,
and pays for it with a card.

## Phase 9 — Beyond v1

Ordered by expected value; each needs a decision first.

- [ ] 9.1 Sandbox Groups (Beta): isolated short-lived compute for untrusted code (`[SANDBOX]`; a new infra spec).
- [ ] 9.2 Preview environments per pull request.
- [ ] 9.3 Alerting and paging; log drains.
- [ ] 9.4 Autoscaling rules editor.
- [ ] 9.5 GitLab and Bitbucket; Docker image and public Git URL sources fully supported.
- [ ] 9.6 SSO/SAML and fine-grained roles.
- [ ] 9.7 Support inbox for customers through the customers accelerator's contact-centre module (its phase 3).

## Designs still needed

Sign in, verify email, forgot password; Projects; workspace-wide Deploys, Metrics and Logs; Environment groups;
GitHub; Billing; Settings and Members; create forms and detail pages for Static Site, Private Service, Worker, Cron
Job, Workflow, Postgres, Key Value and Sandbox Group; the Deploys, Environment, Scaling and Settings tabs of a
service; confirm-delete dialog; empty and error states; the operator fleet view. Phases build these from the
`.nj-` components first and restyle when a design arrives.
