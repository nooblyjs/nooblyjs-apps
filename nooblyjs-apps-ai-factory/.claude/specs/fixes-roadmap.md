---
type: Roadmap
title: 'NooblyJS: fixes and mock removal, trackable roadmap'
description: Every item below belongs to one phase, and each phase has a spec (requirements → design → tasks) in `.claude/specs/`.
tags: [nooblyjs-ai, specs]
---

# NooblyJS: fixes and mock removal, trackable roadmap

> **Created 2026-11-17.** Every fix the steering review found, and every mock or simulated behaviour still in shipped
> code, with what replaces it and what it is blocked on. The mock list starts from the audit in
> `.claude/audits/mocking-audit.md` (A1–A16, B1–B12) and adds what that audit does not yet cover.
>
> **How to use it.** Work top to bottom inside each part. Set the status on the line as you go:
> `[ ]` open · `[~]` in progress · `[x]` done in code, with tests · `[v]` verified by the owner (only the owner ticks
> `[v]`, as in `bugs-and-changes/tasks.md`). A part-2 item is not done until its mock is gone from the shipped code, not
> just switched off. Sizes: **S** under a day, **M** a few days, **L** a week or more.
>
> **Scope.** This file is the tracker. The decisions it needs are in part 0, the code fixes in part 1, the mocks in
> part 2, and the order in part 3. The phases in `roadmap.md` stay the record of what was built.

---

## Specs: where each item is built

Every item below belongs to one phase, and each phase has a spec (requirements → design → tasks) in
`.claude/specs/`. The spec's `tasks.md` names the tracker IDs it closes; tick an item here when its
task is done. Phases 27 and 29–32 together are roadmap Phase 15 (No mocks).

| Phase | Spec | Closes | Blocked on | Status |
| --- | --- | --- | --- | --- |
| 27 | [No mocks in production](.claude/specs/phase-27-no-mocks-in-production/tasks.md) | M-01, M-02, M-05 to M-11, M-32 to M-35 | M-07 (a `nooblyjs-core` PR) | ◐ built 2026-11-17, waiting for review; M-07 open |
| 28 | [Hygiene and the clock](.claude/specs/phase-28-hygiene-and-clock/tasks.md) | FIX-010 to FIX-014, FIX-016 to FIX-019, FIX-025 | nothing (D11, D13 decided) | ◐ in progress (FIX-019 done) |
| 29 | [Scripted answers out](.claude/specs/phase-29-scripted-answers-out/tasks.md) | M-03, M-04, M-21, M-28 (cost) | nothing (D1: direct APIs) | ☐ ready |
| 30 | [Real platform adapters](.claude/specs/phase-30-real-platform-adapters/tasks.md) | M-12, M-19, M-20, M-23, M-36 | D3's region and IaC tool to confirm | ☐ ready to start |
| 31 | [Real assurance adapters](.claude/specs/phase-31-real-assurance-adapters/tasks.md) | M-13 to M-16, M-31 | Phase 30 (D5–D8 decided) | ☐ waits on Phase 30 |
| 32 | [Microsoft 365 and the write gate for real](.claude/specs/phase-32-microsoft-365-for-real/tasks.md) | M-17, M-18, M-22, GATE-12, GATE-13 | D9: a tenant admin; write tokens | ☐ blocked |
| 33 | [Settings, not sample data](.claude/specs/phase-33-settings-not-sample-data/tasks.md) | M-24 to M-30, M-34 | the company's figures and facts | ☐ not started |
| 34 | [Product gaps the steering promises](.claude/specs/phase-34-product-gaps/tasks.md) | FIX-015, FIX-020 to FIX-024 | FIX-021, FIX-024 answers (pen tests: dropped) | ◐ in progress (FIX-020 done) |
| — | [Bug and change log](.claude/specs/bugs-and-changes/tasks.md) | BUG-008 to BUG-012, CHG-010 to CHG-012 | — | open |

---

## Part 0: decisions that unblock the rest

The owner answered these on 2026-11-17. Where the owner asked Claude to choose or suggest, the line says so; those
choices stand unless the owner changes them. Lines marked **still open** need one more answer before their phase starts.

- [x] **D1** Which cloud hosts the models. **Owner: none; the frontier model APIs are called directly** (Anthropic,
  OpenAI and the like, with the company's own keys). Unblocks M-02, M-21, M-22 → Phase 29.
- [x] **D2** Hosting target and container runtime. **Owner: Docker.** Unblocks M-12, M-19 → Phase 30.
  *Still open: the data region* (decide with D3).
- [x] **D3** Cloud for the provisioner. **Owner: Google Cloud.** *Claude's suggestion for the parts not answered:*
  Terraform as the IaC tool (the provisioner runs `terraform plan`, a person approves, then `apply`), and a European
  region such as `europe-west1` unless the company's data rules say otherwise. **Still open: confirm region and
  Terraform.** Unblocks M-11, M-36 → Phase 30.
- [x] **D4** Secret store. **Owner: Docker secrets.** Note: Docker's own secrets need Swarm mode; with plain Docker or
  Compose they are files mounted at `/run/secrets/<name>`. The secrets adapter reads that folder either way and never
  writes. Unblocks M-20 → Phase 30.
- [x] **D5** Scanners. **Claude's choice (owner: "you choose"):** open-source tools that each run as a Docker image and
  write SARIF or JSON:
  Gitleaks (secrets), Semgrep Community Edition (SAST), Trivy (SCA, licences, IaC, container images, and the SBOM in
  CycloneDX), OWASP ZAP baseline scan (DAST against a preview or Test environment). Four tools cover the eight scan kinds.
  Unblocks M-13 → Phase 31.
- [x] **D6** Test runner. **Owner: Jest.** The runner adapter runs Jest suites and reads Jest's JSON report. Jest
  needs helpers for three of the suites: Playwright for the browser (e2e, e2e-smoke), `axe-core` inside those browser
  tests (accessibility), and for load and resilience, plain Jest tests that drive many requests or stop a container.
  Unblocks M-14 → Phase 31.
- [x] **D7** Deployment tool. **Owner: GitHub Actions.** The deployer starts a `workflow_dispatch` run per environment
  and reads its result; rollback runs the same workflow with the previous release. Unblocks M-15 → Phase 31.
- [x] **D8** Monitoring platform. **Owner: none.** So there is no outside monitor: the mock monitor goes, and Operations
  measures what it can itself (a health probe of each deployed service, and deploy and incident records from D7 and
  Operations). SLOs on anything else are entered by a person and labelled as such. Unblocks M-16 → Phase 31.
- [ ] **D9** Microsoft 365 (the Teams bot and mail). **Owner: "please suggest". Claude's suggestion:** register one
  single-tenant Azure Bot in the company's tenant for the Teams bot, give the app Graph `Mail.Send` limited to one
  sending mailbox by an application access policy, and use one named Teams channel for on-call. That needs a tenant
  admin for about an hour. Until that happens, Phase 32 waits, and the Teams simulator is handled as D10 says. **Still
  open: is there a tenant admin who can do this, and when?** Unblocks M-09, M-17 → Phase 32.
- [x] **D10** Development tools in shipped code. **Owner: "you suggest". Claude's suggestion, adopted:** they stay in
  the repositories for development, but production refuses them: `/dev/*` routes (`/dev/teams`, `/dev/clock`,
  `/dev/styleguide`) are not mounted when `NODE_ENV=production`, and the app refuses to start in production if
  `NOOBLY_DEV_LOGIN` is set or the provider is `mock` or `echo`. The echo provider leaves the public exports and lives
  only in tests and the harness labs. The harness labs stay (a developer's tool, not part of the hosted platform).
  Unblocks M-34 → Phase 27.
- [x] **D11** Remove the `Date.now()` fallbacks, so `host.clock` is required everywhere. **Owner: yes.** Unblocks
  FIX-014 → Phase 28.
- [x] **D12** Node floor. **Owner: 24 everywhere.** Done 2026-11-17 (FIX-019).
- [x] **D13** Delete the orphan CommonJS utilities in the host. **Owner: yes, delete.** Unblocks FIX-010 → Phase 28.

Still open from Phase 34: test strategy (FIX-021: build it, or say it is not planned) and the five teammate skills
(FIX-024: seed them, or drop the names).

---

## Part 1: code and documentation fixes

### 1a. Fix now (no decision needed)

- [x] **FIX-010** [S] Done 2026-11-17 (D13), with `validationMiddleware.js`, also unused. Was: Delete the four unused CommonJS files in `src/utils/`: `fileNaming.js`,
  `filePolicy.js`, `pathSafety.js`, `fileTypeUtils.js`. Nothing imports them (checked 2026-11-17). Done when: `npm test`
  passes and `grep` finds no reference. *(depends on D13)*
- [ ] **FIX-011** [S] Remove the unused provider SDK packages from `src/apps/knowledge/package.json`:
  `@anthropic-ai/sdk`, `@anthropic-ai/claude-agent-sdk`, `openai`. No source file imports them. Check
  `test/agent-tasks.test.mjs` first (it mentions them). Done when: `npm install` and the knowledge tests pass.
- [ ] **FIX-013** [S] `scripts/seed.js` header says `--reset` "wipes DATA_DIR first", but the code moves
  it aside (`data.before-blank-…`). Make the comment match the code.
- [ ] **FIX-016** [S] Retire `accept-release-candidate` from `src/middleware/roles.js` once no check
  still uses it. Confirm with a search of stored items first.
- [ ] **FIX-017** [S] Add `nooblyjs-ai-security` and `nooblyjs-ai-operations` to the project table in the root
  `README.md`. Both are built and missing from it.
- [ ] **FIX-018** [S] Steering: `.claude/steering/product.md`, `tech.md` and `structure.md` were not
  reviewed on 2026-11-17. Read them against the code and fix the drift, as was done for the root four.

### 1b. Code gaps the steering promises (need a decision first)

- [ ] **FIX-014** [M] Remove the `Date.now()` fallbacks in `nooblyjs-ai-product` (`services/*.js`),
  `src/apps/design/src/services/design.js`, `src/apps/operations/src/services/{evidence,notes}.js`,
  `src/apps/factory/src/services/{hosted,engineering/architecture}.js` and the `Number(host.clock?.now?.() ?? Date.now())`
  pattern generally. Keep `Date.now()` only for measuring durations. Needs D11. Done when: a test starts each app with
  no `host.clock` and gets an error, not a silent wall-clock time.
- [ ] **FIX-012** [M] `nooblyjs-ai-knowledge` public pages load CSS and scripts from CDNs (`public/index.html`,
  `public/css/wiki-ds.css`, `public/js/markdown/`). Vendor them locally, as the mermaid and codemirror copies already are.
- [ ] **FIX-015** [M] Security (4 test files) and Operations (4) are thin for their size. Add tests for the rules that
  refuse (a Contributor refused, an agent refused, a risk acceptance without a reason or expiry, a production deploy with
  one approver).
- [x] **FIX-019** [S] Align the Node floors (D12): done 2026-11-17, `engines.node` is `>=24` everywhere. Was: the root `engines` say 24, most projects 22.12, Knowledge 20.
- [x] **FIX-020** [M] Pen tests: taken out of the steering 2026-11-17 (owner's call). Was: Security's screens show "Pen tests" in the design but nothing is built. Build the
  screen and its record, or take it out of `design.md` §11 and `product.md` §3.5 `[Take it out]`.
- [ ] **FIX-021** [M] Test strategy: `product.md` §2 says there is no test strategy document of its own. Decide whether
  one is needed; if so, build it in the Test section.
- [ ] **FIX-022** [M] Signals from SLO breaches and failed outcome reviews. Only incidents raise a signal into Product
  today (`src/apps/operations/src/services/incidents.js`). Wire the other two, or record that they stay manual.
- [ ] **FIX-023** [M] Knowledge write-back: accepted ADRs, threat models and post-incident reviews as wiki pages
  (`design.md` §8, decided 2026-10-19). Not built.
- [ ] **FIX-024** [M] The five skills named in `design.md` §6 (`threat-modelling`, `test-writing`, `accessibility`,
  `dependency-audit`, `architecture-decision-records`) are not defined in the seed. Define them as teammate skills, or
  drop the names from the steering.
- [ ] **FIX-025** [S] `design.md` §4 and `roadmap.md` Phase 21 name `pr.opened` as the preview trigger; the code uses
  `pr.recorded`. Confirm the code is right and the item text says `pr.recorded` (already in `design.md` §7).

### 1c. Open bugs and changes (already logged; work them in `bugs-and-changes/tasks.md`)

- [ ] **BUG-008** Linking an item to an objective sent an empty id (S2).
- [ ] **BUG-009** Screen readers misread filter links and five buttons (S3).
- [ ] **BUG-010** The Feedback page scrolled sideways at phone width (S3).
- [ ] **BUG-011** Most of the browser suite expects the product as it was before lifecycle v3 (S2).
- [ ] **BUG-012** Logged in `tasks.md`; read the entry before work starts.
- [ ] **CHG-010** Products are set up on the Portfolios page, not on the board (Product).
- [ ] **CHG-011** `npm run seed:clear` deletes the seeded data (Seed). Check whether this is still the intended result.
- [ ] **CHG-012** Logged in `tasks.md`; read the entry before work starts.

### 1d. Gates from the roadmap

- [ ] **GATE-26** Owner review of Phase 26 (built 2026-10-22, waiting for review).
- [ ] **GATE-12** The Phase 12 tenant run (Microsoft 365, the Teams bot).
- [ ] **GATE-13** The Phase 13 pilot.
- [ ] **GATE-PILOT** The whole-loop pilot with one squad on one product ("After Phase 23").

---

## Part 2: mocks, simulators and fakes in shipped code

Scope: code that runs when the app runs, not tests. Test doubles that live under `test/` are out of scope and stay.
Each item says what it is, where, what the shipped code does with it, and what replaces it. The audit IDs in brackets
are from `mocking-audit.md`.

Actions: **REMOVE** (delete, no replacement needed) · **REPLACE** (a real adapter, blocked on a decision) ·
**GUARD** (keep only where it cannot reach production, and say so) · **MOVE** (out of shipped code, into a test or
dev-only tool).

### 2a. Mocks that can reach production today (fix first)

- [x] **M-01** *(Phase 27, 2026-11-17: no default; mock and echo refused in production.)* [A1] **Host defaults `AI_PROVIDER` to `mock`.** `src/config.js:59`
  (`env.AI_PROVIDER || 'mock'`). A production start with no provider setting runs scripted answers. Action: REMOVE the
  default; refuse `mock` when `NODE_ENV=production`, the same way `anthropic` is refused. Size S. No decision needed.
- [x] **M-02** *(Phase 27, 2026-11-17: production never returns the mock; no model refuses with `no_model`.)* [A1, A2] **Teammates falls back to the mock in production.** `src/apps/teammate/src/services/providers/index.js`
  (lines 31–74) returns `MockProvider` whenever no model is set, and accepts `AI_PROVIDER=mock` in production.
  Action: refuse `mock` in production; with no model configured, a task is refused with a reason, not answered. Size S.
  The real providers still need D1.
- [ ] **M-03** [A1] **Scripted answers play when no model is set.** Each one is a "scripted" or `mock()` branch:
  - Product drafts: `src/apps/product/src/services/draft-kinds.js` (`mock()` at 96, 124),
    `architecture.js` (520, 556), `ux.js` (249, 272, 303), `ui.js` (270, 289), and `drafting.js` (168, 251–265).
  - Factory architecture: `src/apps/factory/src/services/engineering/architecture.js` (153–169).
  - Test analysis: `src/apps/factory/quality/src/services/analysis.js` (159–175) and
    `quality/src/services/drafts.js`.
  - Infrastructure design: `src/apps/infrastructure/src/services/drafts.js` (36–113, `scripted`).
  - Host chat and Teams: `chat/scripts.yaml` and `teams/scripts.yaml` (seeded at `src/seed/index.js:40–41`), played by
    `src/teams/bot.js` (75, 203–274) and the chat reply path.
  - Wiki: `src/apps/knowledge/src/wiki/knowledge/answers.js` answers from the source sentences.
  Action: REMOVE the scripted branch from production. With no model, the action says so and nothing is posted, drafted
  or billed. The scripts stay as test fixtures under `test/`. Size L (about ten places). Needs D1 only for the real
  path. *(audit A1; A5 is stale: Infrastructure does draft)*
- [ ] **M-04** [A1] **The Software Factory's demo repository and scripted agents.** `src/apps/factory/src/services/intake/demo-repo.js`,
  `hosted.js` (475–484, "scripted agents (development and demos)"), `intake/handoff.js` (`<home>/scripts/`), and
  `remote/worker.js` (65). Action: the demo repository is MOVE to a dev seed; production never writes scripted agents;
  a work item with no model fails with "no model configured". Size M.
- [x] **M-05** *(Phase 27, 2026-11-17: scripts refused in production (line, CLI, intake).)* [audit-new] **Scripted providers in the Factory's line.** `src/apps/factory/src/services/exec/harness/script.js`
  (a model from a JSON file), used by `line/stations/common.js` (51–55), `controllers/cli/agent.js` and
  `controllers/cli/init.js`. Action: GUARD: the `--script` flag exists only with `NODE_ENV` not production, and the line
  refuses a scripted provider in production. Size S.
- [x] **M-06** *(Phase 27, 2026-11-17: bench oracle/null refused in production (kept: they are the measuring instrument).)* [audit-new] **Scripted runs in the benchmark.** `src/apps/factory/src/services/bench/runner.js` (34–65) gives
  the oracle and null agents scripted providers. Action: MOVE to the bench's test fixtures, or make the bench refuse to
  run without a real model. Size S.

### 2b. Mock providers and fakes exported by the shared libraries

- [ ] **M-07** *(Phase 27: not done. `nooblyjs-core` is a separate repo; NooblyJS never selects its `mock` type. Needs its own PR.)* [A1] **The AI module's mock provider.** `nooblyjs-core/src/aiservice/common/providers/mock.js`, registered in
  `providers/index.js` and listed in `aiservice/index.js` (`SHARED_TYPES`). This is a **separate repo** (`nooblyjs-core`),
  so the change is made there. Action: MOVE the mock to a test helper; remove `mock` from `SHARED_TYPES`. Size S,
  cross-repo. *(Blocks M-01 and M-02 being fully clean.)*
- [x] **M-08** *(Phase 27, 2026-11-17: mock and echo out of the public API (`nooblyjs-ai-harness/testing.js`); echo not offered, refused in production.)* [A1] **Harness mock and echo providers, exported publicly.** `nooblyjs-ai-harness/src/providers/mock.js`
  (re-exports the common one), `src/providers/echo.js` ("a fake provider that never calls the internet, so you can try
  noobly for free"), `src/index.js:89` (public export of `createMockProvider`), and the factory's `services/harness.js:17`
  re-export. Action: MOVE the mock out of the public exports into test support; REMOVE the echo provider from the
  product, or keep it only as a documented dev command (D10). Size M.
- [x] **M-09** *(Phase 27, 2026-11-17: no change: D10 keeps the labs (teaching material under `.claude/`).)* [A1] **Harness labs use a scripted model.** `nooblyjs-ai-harness/.claude/learning/labs/watch-the-loop.js`
  and `watch-a-denial.js` run on `createMockProvider`. Action: point them at a real provider when a key is set, or drop
  them. Size S.
- [x] **M-10** *(Phase 27, 2026-11-17: fake provider moved to `test/support/`, `dev:mock` dropped.)* [A1] **Desktop's fake provider.** `nooblyjs-ai-desktop/scripts/mockProvider.js` and `scripts/dev-mock.js`
  (`npm run dev:mock`), plus the `MOCK_API_KEY` provider it registers. Desktop is standalone. Action: REMOVE the
  `dev:mock` script and the provider from the app; keep one in its test folder. Size S.
- [x] **M-11** *(Phase 27, 2026-11-17: dry run moved to `test/live-smoke.test.js`; the script makes real calls only.)* [A1] **Teammates' mock in the teammate library's own scripts.** `src/apps/teammate/scripts/live-smoke.js`
  (`AI_PROVIDER=mock npm run smoke:live` is a "free dry run"). Action: MOVE the dry run to the test suite. Size S.

### 2c. Mock adapters for external systems (each needs a decision; the seam already exists)

Each adapter is `mock` by default and refuses any other name at start, so the switch to real is one place. The work is
the real adapter, with its credentials, sandbox and tests.

- [ ] **M-12** [A3, B2, B11] **Container runtime is simulated.** `src/services/platform/containers.js`,
  `data/platform/pools.yaml` and `environments.yaml` (typed in), the "Cluster healthy (simulated)" text on
  `public/js/pages/platform/containers.js`. REPLACE with a runtime adapter. Needs D2. Size L.
- [ ] **M-36** [A4, B2] **Provisioner is a mock.** `src/apps/infrastructure/src/provisioners/mock.js` and
  `index.js` (`INFRA_PROVISIONER`, `INFRA_MOCK_STEP_MS`, in `index.js:67–68`). Plans, cost and drift come from files
  (`services/cost.js`, `services/drift.js`). REPLACE. Needs D3. Size L.
- [ ] **M-13** [A12] **Security scanner is a mock.** `src/apps/security/src/scanners/mock.js` (plain rules, a fixed DAST
  finding, no image scan) and `src/scanners/index.js`. REPLACE per kind. Needs D5. Size L.
- [ ] **M-14** [A13] **Test runner runs nothing.** `src/apps/factory/quality/src/runners/mock.js` (a fixed p95 of 240 ms,
  a baseline e2e count, accessibility and resilience that "find nothing"). REPLACE. Needs D6 and M-12. Size L.
- [ ] **M-15** [A14] **Deployer records and does not deploy.** `src/apps/operations/src/deployers/mock.js` and
  `index.js`. REPLACE through Infrastructure, behind the two-approver rule (I10). Needs D7 and M-36. Size L.
- [ ] **M-16** [A15] **Monitor is a mock.** `src/apps/operations/src/monitors/mock.js`: SLO burn only when a person burns
  it, goal measures halfway to target unless set. REPLACE. Needs D8. Size L.
- [ ] **M-17** [A10, A11] **Teams and mail have only met a simulator and a fake Graph.** `src/services/notify.js`,
  `src/teams/connector.js`. REPLACE through the tenant run. Needs D9 and GATE-12. Size M.
- [ ] **M-18** [A9] **Writes to Jira and Bitbucket are recorded, not sent.** `src/services/devtools/writes.js`.
  This is the default on purpose. Action: keep as the default; the Owner's switch to Send is the real path; test it
  against a scratch project (Phase 13 script). Needs write tokens. Size S once tokens exist.
- [ ] **M-19** [A8] **No sandbox on Windows.** Gate commands run unsandboxed in development. Action: GUARD: refuse to run
  gate commands on Windows outside development, and run them in the M-12 runtime when it exists. Needs D2.
- [ ] **M-20** [A7] **Secrets are references nobody resolves.** `src/services/platform/index.js`. REPLACE
  with a secret-store adapter that hands a value to a run and nothing else. Needs D4. Size M.
- [ ] **M-21** [A2] **Models run on the direct Anthropic API in development.** The Bedrock, Vertex and Azure adapters in
  `nooblyjs-core/src/aiservice/common/providers/` have never run with real credentials. REPLACE the default path with one
  cloud host, proven by a live test (`*.live.test.js`). Needs D1. Size M.
- [ ] **M-22** [A16] **On-call alerts only reach the simulator.** `src/services/notify.js` (`oncall`), with
  `TEAMS_ONCALL_CONVERSATION` unset. REPLACE with the tenant's channel (M-17). Needs D9.

### 2d. Static data shown as if it were measured (audit part B)

- [ ] **M-23** [B1] **Base images typed into a file.** `data/platform/base-images.yaml`: "14 repos", "rolled 3 h ago", CVE
  counts. REPLACE with an image registry and scanner read. Needs D5 and a registry. Size M.
- [ ] **M-24** [B3] **Which teammate drafts each stage is written in code.** `ada-quill`, `rhea-voss`, `design-agent`,
  `ui-agent` in `src/apps/product/src/services/{spec-writes,architecture,ux,ui}.js` and `ines-tau` in Infrastructure's
  `agent.yaml`. REPLACE with a setting per kind of work, and a clear message when nobody is assigned. Size M.
- [ ] **M-25** [B4, B5] **Onboarding copy and first-week tasks name seed items and agents.** `data/config/work-roles.yaml`
  (`PRD-031`, the tool lists). REPLACE with copy generated from what is hired and connected. Needs M-24. Size S.
- [ ] **M-26** [B6] **Standards, accessibility rules and readiness checks are sample values.** `data/product/standards.yaml`
  ("approvedStack: Node 22, Java 21…"), `accessibility.yaml`, `data/workflows/readiness.yaml`. REPLACE with the company's
  own, edited by an Architect. Needs the real standards. Size S once supplied.
- [ ] **M-27** [B7] **Budgets, model routes and guardrails start from sample figures.** `data/platform/budgets.yaml`
  ($9,000 for Teammates, $20 a day for the Factory), `model-routes.yaml`, `guardrails.yaml`. REPLACE with figures an
  Owner sets. Needs the figures. Size S.
- [ ] **M-28** [B8] **Teammate rates and tokens per hour are sample billing settings.** `src/apps/teammate/src/config/seed-data.js`
  (`models.md`), and model prices from a public catalogue (`nooblyjs-core/src/aiservice/common/discovery.js`). REPLACE
  with agreed rates and cost from the provider's own usage. Needs D1 and the billing model. Size M.
- [ ] **M-29** [B9] **Company facts are placeholders.** Data region, cloud, cluster, registry: `[PLACEHOLDER]` in
  `data/config/organisation.yaml`. REPLACE with the facts. Needs the facts.
- [ ] **M-30** [B10] **"For you" tile with no source.** "New signals" shows a null value (`src/services/for-you.js`).
  REPLACE by wiring it to the Product signals, or REMOVE the tile. Size S.

### 2e. Mock labels and stubs that go when the real thing lands

- [ ] **M-31** [A12–A15] **"Mock" notices on screens.** `src/apps/security/public/js/lib.js` (`mockNote`), Operations'
  `releases.js`, `deployments.js`, `slos.js`, `policies.js`, the Factory's Test pages, `profile.js` ("offline mock"). Each
  one is honest and stays until its adapter is real; then remove it. Tied to M-13 to M-16.
- [x] **M-32** *(Phase 27, 2026-11-17: moved to `test/fixtures/clock.js`.)* [audit-new] **`createFakeClock` is exported from the Factory's public index.** `src/apps/factory/index.js:6`.
  A test helper in the public API. MOVE to `test/`. Size S.
- [x] **M-33** *(Phase 27, 2026-11-17: workers pass no app; `initializeAIInstances` works without one.)* [audit-new] **Workflow steps pass a no-op stub app.** `src/apps/knowledge/workflows/application-design/steps/process.js`
  (56–67) and `document-processing/steps/clean-document.js` (60–66): a `Proxy` and a plain object stand in for an Express
  app. Action: pass the real app, or a documented adapter with no stub methods. Size S.
- [x] **M-34** *(Phase 27, 2026-11-17: D10: kept, absent in production; tests in `test/no-mocks-in-production.test.js`.)* [audit-new] **Dev-only tools in the shipped app.** `/dev/teams`, `/dev/clock`, `/dev/styleguide`, the person
  picker (`NOOBLY_DEV_LOGIN`), `TEAMS_BOT_DEV_UNSIGNED`, the simulator routes (`src/routes/dev.js`, `src/routes/teams.js`
  dev key). Decision D10. Until decided: confirm each is refused in production (a test for each).
- [x] **M-35** *(Phase 27, 2026-11-17: confirmed: a blank seed writes none (`test/blank.test.js`).)* [audit-new] **Scripted demo data in the seed.** `src/seed/metrics-history.js` writes six weeks of
  metrics history; `src/apps/teammate/src/services/seed.js:133` writes `mock/scripted` task records. The audit's part C
  says a blank start writes none of this. Confirm, and make sure the sample story is the only place either appears.

---

## Part 3: sequence

Work in this order. Each wave can start once the one before it is done; the phases are in the Specs table above.

1. **Wave 1 (ready now):** Phase 27 (no mocks in production, with D10's production guard) and all of Phase 28
   (dead code, words, the retired permission, vendoring, the clock now D11 is yes).
2. **Wave 2 (ready now):** Phase 29, the real model calls (D1: the frontier APIs directly).
3. **Wave 3, the platform:** Phase 30 (Docker, Docker secrets, Google Cloud with Terraform once the region is
   confirmed), then Phase 31 (Gitleaks, Semgrep, Trivy, ZAP; Jest; GitHub Actions; no outside monitor).
4. **Wave 4, the tenant:** Phase 32 once a tenant admin has done D9.
5. **Wave 5, the product decisions:** Phases 33 and 34 (they can start earlier where their tasks need no answer:
   Phase 33 tasks 1–4, Phase 34 tasks 1–2).
6. **Gates:** GATE-26, GATE-PILOT. Each one is the owner's to tick.

---

## Part 4: corrections to the mocking audit

The audit (`.claude/audits/mocking-audit.md`, updated 2026-10-21) is the source for part 2. These are the
places it no longer matches the code. Fix them when the audit is next updated, not in this file.

- [ ] Paths are old: `noobly/src/...` is now `src/...`, and Product's drafts are in `nooblyjs-ai-product/`,
  not `src/apps/factory/product/`.
- [ ] **A5 is stale.** Infrastructure does draft: `drafts.js` has a scripted draft and a model draft (see M-03).
- [ ] **A1 misses** the scripted branches in the Factory's architecture, the test analysis, Infrastructure's draft, the bench,
  the harness echo provider and the desktop app (M-03 to M-10).
- [ ] **Missing line:** `AI_PROVIDER` defaults to `mock` in the host and the Factory treats `mock` as "no model" (M-01).
- [ ] **Missing line:** the Factory's `services/exec/harness/script.js` (a scripted model from a file) (M-05).
- [ ] **Missing line:** `createFakeClock` in the public API (M-32).
</content>
