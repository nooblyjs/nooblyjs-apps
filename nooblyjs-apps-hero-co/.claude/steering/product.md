---
inclusion: always
type: Steering
title: NooblyJS Cloud — Product
description: Source of truth for what NooblyJS Cloud (nooblyjs-apps-hero-co) is, who it is for, every screen and what v1 includes.
tags: [hero-co, nooblyjs-cloud, steering, product]
---

# NooblyJS Cloud — Product

> **Status:** Draft v1 · 2026-11-19, revised the same day (theme location, payments accelerator, `mount()` everywhere). Derived from the design team's style guide and the five screen mock-ups in
> `.claude/steering/ui/` (`NooblyJS Cloud — Style Guide & Product Specification.md` and `NooblyJS Cloud.html`).
> What it is built with is `stack.md`; the order it is built in is `roadmap.md`.
> Numbers in the mock-ups (8 services, 3.1 vCPU, 48 GB) are **sample data** for one story (§9), not targets.
> Anything in `[BRACKETS]` is an open decision (§11).
> **The style guide (§2 of the UI spec) is the visual source of truth.** This file does not repeat the tokens. The theme
> file it names is the NooblyJS theme at `/workspaces/codespaces-blank/nooblyjs/styling/styles.css` (`stack.md` §5).

---

## 1. In one paragraph

**NooblyJS Cloud** is a self-service hosting platform, in the same family as Heroku and Render, that runs on NooblyJS
engineering. A customer signs up (email or GitHub), connects GitHub, picks a service type, chooses a repo, a branch, a
runtime and an instance size, and gets a live service on `https://<name>.nooblyjs.app` that redeploys on every push.
Afterwards they watch each service's **CPU, memory, requests and bandwidth** against its limits and read its **live and
historical logs**. The people who run NooblyJS Cloud (the operator) use the same platform's back office to see their
customers, talk to them and keep the fleet healthy.

## 2. Who it is for

| Person | What they want | What they must never have to do |
| --- | --- | --- |
| **Developer** (customer; "Stevie" in the mock-ups) | Ship a repo to a URL in minutes; see what each service uses and costs; read logs when something breaks. | Write Terraform, configure Nginx, SSH into a VM, pick a cloud. |
| **Team owner** (customer) | One workspace for the team; projects per product; environments (Production, Staging); a bill they can predict. | Share one login; guess what next month costs. |
| **Operator — platform engineer** (NooblyJS staff) | Keep the fleet of hosts healthy, add capacity per region, see failed builds across tenants. | Hand-place every customer service on a VM. |
| **Operator — customer success / support** (NooblyJS staff) | See a customer's profile, workspaces, services and messages in one place; send the right email at the right time; respect consent. | Query the database by hand to answer "what is this customer running?". |

## 3. Product principles

From the style guide, plus the platform rules underneath it:

1. **Warm, not a console.** The NooblyJS theme everywhere. The only dark surface is the log viewer.
2. **Numbers always have units and limits.** "0.84 vCPU · 42%" with "Limit 2 vCPU", never a bare number.
3. **Say what happens.** Buttons name the exact action: *Deploy web service*, *Manual deploy*, *Restart*, *Suspend*.
4. **Price before you commit.** Every create form has a sticky Summary with the instance, compute and an
   *Estimated / mo*. Lists show what each service is using of what it reserved.
5. **Long things show progress.** Builds, deploys and restarts are operations with named steps that update live and
   survive a server restart (the infrastructure accelerator's operations engine).
6. **Push is the deploy button.** Auto-deploy on push to the chosen branch is on by default; *Manual deploy* is there
   for everything else.
7. **Safe by default.** Private services and data stores are reachable only from the workspace's own services;
   secrets are never shown after save without an audited reveal; destructive actions ask for the name.

## 4. Scope

### In scope for v1 (from the UI spec)

| Area | Capabilities |
| --- | --- |
| **Accounts** | Sign up with email (name, team or company, work email, password ≥ 12 chars with a number) or **Continue with GitHub**; sign in; free tier without a card. |
| **Workspaces and projects** | A workspace per team (e.g. *Exclusivity Life*); projects inside it; environments inside a project (*Production*, *Staging*). Members invited by email with one role (§7). |
| **Service types** | Nine (§6.2): Static Site, Web Service, Private Service, Background Worker, Cron Job, Workflow, Postgres, Key Value, Sandbox Group (Beta). |
| **Source** | GitHub connect (app install or OAuth, organisation access), repo search, branch pick; auto-deploy on push. Public Git URL and Docker image appear in the UI as source tabs. |
| **Build** | Node.js 22, Python 3.12, Go 1.23, or a Dockerfile in the repo; root directory; build command; start command. |
| **Regions** | Johannesburg (af-south), Frankfurt (eu-central), Virginia (us-east), Singapore (ap-southeast). |
| **Compute** | Instance types Free (0.1 CPU · 512 MB), Starter (0.5 CPU · 512 MB), Standard (1 CPU · 2 GB), Pro (2 CPU · 4 GB), Pro Plus (4 CPU · 8 GB); instance count with traffic balanced across instances. Change type later without redeploying. |
| **Metrics** | CPU, memory, requests, bandwidth per service and per instance, over a selectable range; environment totals. |
| **Logs** | Live tail and historical logs per service, both instances interleaved, filter by level, search; kept 7 days on Standard. |
| **Environment** | Environment variables per service, *Add from .env*, environment groups linked to many services. |
| **Deploys** | Deploy history per service and per environment: commit, message, trigger (push or manual · person), status, when. Restart, Suspend, Manual deploy. |
| **Domains** | `<service>.nooblyjs.app` for every public service; one custom domain per service. |
| **Billing** | Free tier; card on file when exceeding it (captured by the payment provider's hosted fields, never by us); estimated monthly cost per service and per workspace; monthly invoices from metered usage. Built on `nooblyjs-accel-payments`. |
| **Operator back office** | Customer 360 (profile, organisation, consent, notes, timeline, audit) and transactional email (welcome, verify email, deploy failed, card needed) from the customers accelerator. |

### Out of scope for v1 (from the UI spec)

SSO and SAML, fine-grained roles · custom-domains UI beyond one per service · GitLab and Bitbucket · a buildpack
marketplace · an autoscaling rules editor · alerting and paging · log drains to third parties · preview environments
per pull request · marketing campaigns to customers (the customers accelerator's campaign module stays off until
consent and suppression flows are reviewed, §11) · the contact-centre support module.

## 5. Navigation

Top bar: product mark **NooblyJS Cloud**, workspace switcher (avatar initial + workspace name), user menu.

Sidebar (from the mock-ups, in order), heading **Workspace**:

**Dashboard** · **New service** · **Projects** · **Deploys** · **Metrics** · **Logs** · **Environment groups** ·
**GitHub** · **Billing** · **Settings**

| Path | Screen | Mock-up |
| --- | --- | --- |
| `/` (signed out) | Marketing + sign up | *Sign up* |
| `/services/authservice/views/login.html` | Sign in: nooblyjs-core's authservice login page, the only sign-in screen for customers and operators (decided 2026-11-20). `?returnUrl=` brings them back; without it customers go to their workspace and operators to `/admin`. `/signin` redirects here. | core's page |
| `/w/:workspace` | Environment dashboard (default project, Production) | *Production dashboard* |
| `/w/:workspace/new` | Create a new service — choose type | *Create a new service* |
| `/w/:workspace/new/:type` | New service of that type (repo → build → instance → env → deploy) | *New web service* (the template for all app types) |
| `/w/:workspace/services/:service` | Service detail (tabs: Overview, Metrics and logs, Deploys, Environment, Scaling, Settings) | *api service* |
| `/w/:workspace/projects`, `/deploys`, `/metrics`, `/logs`, `/env-groups`, `/github`, `/billing`, `/settings` | Workspace lists | none yet |
| `/admin/...` | Operator back office (customers accelerator UIs + fleet view) | customers accelerator's own UI |

Every page is a real URL: refresh and deep links land on the same screen.

## 6. Screens

### 6.1 Sign up (`/`)

- Top bar: Product · Docs · Pricing · **Sign in**.
- Hero: eyebrow *Runs on NooblyJS Engineering*; title *From a GitHub repo to a live service, without the ops work.*;
  lead *Connect your repository, pick what you are running and NooblyJS Cloud builds it, deploys it on every push, and
  shows you exactly what each service is using.*
- *What you can launch*: the nine service types as chips.
- Three feature rows: **Connect GitHub** (pick a repo and branch; every push deploys), **See resources** (CPU, memory and
  bandwidth for each service), **Read live logs** (stream, search and filter by level).
- Card **Create your account** — *Free to start. Add a card when you need more than the free tier.* — **Continue with
  GitHub**, divider *or sign up with email*, fields Your name, Team or company, Work email, Password (hint *Use 12 or
  more characters with a number.*), **Create account**, *Already have an account? Sign in*.
- On create: a person, a workspace named after the team, a default project and a *Production* environment; a customer
  record and organisation in the customers accelerator (§8); a welcome / verify-email message.

### 6.2 Create a new service (`/w/:workspace/new`)

- Breadcrumb *Workspace · Production*; title **What are you launching?**; lead *Pick a service type. You will connect a
  GitHub repo in the next step.*; link *Which one should I use?*
- Stepper: **1 Choose service** · 2 Connect repo · 3 Configure · 4 Deploy.
- **Apps and services**: Static Site, Web Service, Private Service, Background Worker, Cron Job, Workflow.
- **Data and compute**: Postgres, Key Value, Sandbox Group (**Beta**).
- Each option card: icon circle, name, one-sentence use, and a button naming the action (*New web service*, *New
  worker*, *New Key Value instance* …). Copy is in the mock-up and is used verbatim.

### 6.3 New web service (`/w/:workspace/new/web`)

Numbered fieldsets with a sticky **Summary** beside them (below at phone width):

1. **Source code** — tabs GitHub · Public Git URL · Docker image. Banner *GitHub connected · stevie · 2 organisations*,
   *Change repo access*; search; repo rows (owner / name, language · pushed when, Public/Private), one selected.
2. **Build and run** — Service name (*Your URL will be `<name>.nooblyjs.app`*), Branch, Region, Runtime (Node.js 22,
   Docker, Python 3.12, Go 1.23), Root directory (optional), Build command, Start command.
3. **Instance type** — option cards Free · Starter · Standard · Pro · Pro Plus with price and CPU · RAM; *This is the CPU
   and memory reserved for each instance. You can change it later without redeploying.* **Instances** stepper —
   *Traffic is balanced across instances. Add more for zero-downtime deploys.*
4. **Environment variables** — key/value rows (`NODE_ENV`, `DATABASE_URL`), **Add variable**, **Add from .env**,
  **Link environment group**.

Summary: Type, Repo, Branch, Instance, Compute (*spec × count*), **Estimated** (*$/mo*), **Auto-deploy** switch
(*Deploy on every push to main*), **Deploy web service**, *Your first build starts straight away. You can watch it in
the logs.* Deploying goes to the service page with the build log open.

The other app types reuse this screen and drop what they do not need: Static Site (build command + publish directory,
no instances, CDN), Private Service (no public URL; internal host name), Background Worker (no port, no URL), Cron Job
(schedule instead of instances; command), Workflow (task definitions, concurrency cap). Postgres, Key Value and Sandbox
Group have their own short forms (name, region, plan, version) — designs needed (roadmap).

### 6.4 Environment dashboard (`/w/:workspace`)

- Breadcrumb *Exclusivity Life*; title **Production**; lead *8 services · Johannesburg (af-south) · connected to GitHub
  as stevie*; buttons **Environment** (switch) and **New service** (primary).
- **Stat tiles**: Services running (*7 of 8*, *1 deploying · orders*), CPU in use (*3.1 / 7.5 vCPU*), Memory in use
  (*6.4 / 16 GB*), Bandwidth this month (*48 GB of 100*).
- **CPU allocated by service**: a stacked bar with a legend (*7.5 vCPU reserved across 8 services*).
- **Services**: one row per service — name, type · plan, status pill, two type-specific meters, commit · when.
  Meters by type: web/private/worker → CPU and Memory; static → Bandwidth and Cache hit rate; workflow → Tasks running
  and Queue; Postgres → Storage and Connections; Key Value → Memory and Connections; cron → Last run and Peak memory.
- **Recent deploys** table: Service, Commit, Message, Trigger, Status, When.
- Statuses and pill colours: *Live* (teal), *Deploying* / *Building* (warning), *Failed* (danger), *Suspended* /
  *Succeeded* (cron) / idle (neutral).

### 6.5 Service detail (`/w/:workspace/services/:service`)

- Breadcrumb *Production / api*; title with status pill; line *Web service · Node.js 22 · 2 × Standard · Johannesburg*;
  URL `api-exclusivity.nooblyjs.app`; repo · branch · commit. Buttons **Restart**, **Suspend**, **Manual deploy**
  (primary).
- Tabs: **Overview** · **Metrics and logs** · Deploys · Environment · Scaling · Settings.
- **Resources**: metric switcher (CPU, Memory, Requests, Bandwidth) with value, unit and limit; area chart over a range
  (start → now). Metric colours are fixed by the style guide.
- **Instances**: tile per instance (id, Healthy, CPU *0.46 / 1 vCPU*, Memory *1.16 / 2 GB*, *Up 12 min · 0 restarts*);
  link *Change instance type or count*.
- **Logs** (dark viewer): Live / Paused, level filters, *Search logs*, lines of time · instance · level · message;
  empty state *No log lines at this level in the last hour.*; footer *Showing N lines · both instances* and *Logs are
  kept for 7 days on Standard*.

### 6.6 Screens with no mock-up yet

Projects, Deploys (workspace-wide), Metrics (workspace-wide), Logs (workspace-wide), Environment groups, GitHub
(connections and repo access), Billing (plan, usage, card, invoices), Settings (workspace, members, danger zone),
Postgres / Key Value / Sandbox Group create forms and detail pages, Cron Job and Workflow detail pages, sign in,
verify email, forgot password, empty states and error pages. They are built from the same tokens and `.nj-`
components until designs arrive (roadmap "Designs still needed").

## 7. Who may do what

v1 has **one role per workspace member** plus the operator roles; fine-grained roles are out of scope.

| Action | Owner | Member | Operator (support) | Operator (platform) |
| --- | --- | --- | --- | --- |
| See services, metrics, logs, deploys | ✓ | ✓ | read-only, audited | ✓ |
| Create, deploy, restart, suspend services; edit env vars | ✓ | ✓ | — | — |
| Delete a service or data store; reveal a secret; change instance type | ✓ | ✓ (confirm-typed) | — | — |
| Invite or remove members; GitHub connection; billing; delete workspace | ✓ | — | — | — |
| Customer 360, notes, transactional messages | — | — | ✓ | — |
| Hosts, regions, capacity, fleet health | — | — | — | ✓ |

The API is the control, not hidden buttons. Every write and every refusal is audited.

## 8. How the parts map to the product

| Product concept | Comes from |
| --- | --- |
| Sign-in, sessions, API tokens, logging, queues, scheduling, workflow, measuring, caching, notifying, search, files | **nooblyjs-core** services |
| Fleet hosts in each region, the operations engine (resumable steps), builds, containers on shared hosts, ingress and `*.nooblyjs.app`, rolling deploys, per-instance metrics and logs, Postgres, Key Value, static sites on a CDN, cost catalogue | **nooblyjs-accl-infrastructure** (Noobly Cloud), mounted with `mount()` as the platform's control plane through its in-process `services.platform` API (its roadmap phase 8); not shown to customers |
| Customer and organisation records behind each sign-up, consent, notes, timeline, audit, transactional email with suppression | **nooblyjs-accel-customers** (customer + marketing modules), used in the operator back office |
| Billing accounts, plans and prices, metered usage, subscriptions, invoices, card capture, collection and dunning, refunds, ledger | **nooblyjs-accel-payments** (new accelerator, `mount()`), with Stripe and Paystack behind a mock-first provider contract |
| Workspaces, projects, environments, service types, metric history and the log viewer, every customer-facing screen | **This repo** (new), built on the four above |

## 9. Seed story

`npm run seed` reproduces the mock-ups offline: person **Stevie** (Owner), workspace **Exclusivity Life**, project
default, environment **Production** in Johannesburg, GitHub connected as `stevie` with 2 organisations and the repos
`stevie/nooblyjs-blog`, `exclusivity-life/digital-teammates`, `exclusivity-life/software-factory`, `stevie/space-trader`,
`exclusivity-life/engx-platform`. Services: `api` (web, 2 × Standard, Live), `storefront` (static, Live),
`agents` (worker, 1 × Pro, Live; last manual deploy Failed), `orders` (workflow, Deploying), `database` (Postgres 16,
Pro · HA), `cache` (Key Value, Starter), `records` (private, 1 × Starter), `etl` (cron, daily 02:00, Succeeded). The
recent deploys and log lines from the mock-ups. Every count and total on screen is computed from these records.

## 10. Success measures

- New sign-up to a live web service on `*.nooblyjs.app` in **under 5 minutes** (GitHub connected, Node repo).
- Push to live in **under 2 minutes** for a typical Node service; zero failed requests during a deploy with 2+ instances.
- The *Estimated / mo* shown before deploy is within 5% of the first full month's bill.
- Log lines visible in the live tail **under 3 seconds** after the process writes them.
- No customer can see, reach or affect another workspace's services, logs, metrics or secrets.

## 11. Open questions

- ~~`[STYLE]`~~ **Decided 2026-11-19:** the theme is `nooblyjs/styling/styles.css`, copied verbatim (`stack.md` §5).
- ~~`[RUNTIME]`~~ **Decided 2026-11-19:** containers on shared hosts, built and run by the infrastructure accelerator's
  phase 8 (specs in `nooblyjs-accl-infrastructure/.claude/specs/`).
- ~~`[ENTRY]`~~ **Decided 2026-11-19:** every accelerator mounts with `mount(app, eventEmitter, serviceRegistry, options)`.
- `[BILLING]` Card capture, invoices and dunning come from `nooblyjs-accel-payments` (decided 2026-11-19). Still open:
  the first provider (Stripe or Paystack, payments O2). Plans decided 2026-11-20 (`public/js/shared/catalog.js`): four
  instance types, Starter $0 (the free tier; there is no separate Free plan), Standard $5, Pro $20, Pro Plus $100. The
  price is flat per service per month for 1 to 10 instances. Web and Private services sleep after 15 minutes without
  requests and wake on the next one, which keeps the flat price affordable (roadmap 3.11).
- `[GITHUB]` GitHub App (per-repo install, webhooks built in) vs OAuth app + personal tokens (what the infrastructure
  accelerator does today). nooblyjs-core has no GitHub sign-in provider; it can come through the `passport` provider.
- `[MARKETING]` Whether the operator may send marketing (not just transactional) email to customers in v1.
- `[SANDBOX]` Isolation technology for Sandbox Groups (gVisor/Firecracker vs bubblewrap as in the AI harness).
