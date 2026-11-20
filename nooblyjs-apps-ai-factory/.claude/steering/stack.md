---
inclusion: always
type: Steering
title: 'NooblyJS Software Factory: stack'
description: No build step.
tags: [nooblyjs-ai, steering]
---

# NooblyJS Software Factory: stack

> **Status:** Draft v1 · 2026-10-19, revised 2026-11-17 against the code. What the factory is built with, what each
> project actually uses today (checked against every `package.json`, every test folder and every adapter on
> 2026-11-17), where projects differ from the rules, and the tools the new SDLC stages need. The full rules are in
> `.claude/steering/tech.md`, and the summary every project carries is
> `.claude/steering/nooblyjs-ai-shared-rules.md`. This file does not repeat them; it adds the
> whole-factory view and the decisions still to take.

---

## 1. The stack at a glance

| Layer | Choice | Not allowed |
| --- | --- | --- |
| Runtime | Node.js 24 LTS (`engines` `>=24` in every project), ES modules | CommonJS in new code (`createRequire` is how the ESM code loads `nooblyjs-core`'s CommonJS) |
| Server | Express 5, JSON APIs, Server-Sent Events + `POST` for live updates | Next, Nest, Fastify, GraphQL, WebSockets in new code |
| Browser | Plain HTML, CSS and JS as native ES modules, on the shared UI kit (`nooblyjs-core/public/ui/`) | React, TypeScript, bundlers, CSS frameworks, CDNs |
| Storage | Markdown + YAML front matter, YAML config, append-only daily YAML event streams, through FsStore (atomic writes, per-path locks, path checks) | SQLite, Postgres, Mongo, Redis as a store of record, JSON databases |
| Shared services | `nooblyjs-core`: auth (local, Google, Entra), logging, caching, queueing, scheduling, notifying, measuring, searching, workflow, filing | Re-implementing any of them per project |
| AI | The AI module (`nooblyjs-core/src/aiservice/common`, imported as `nooblyjs-core/ai`): providers, discovery, catalogue, tokens, cost. Asked for by **work type** through Platform's model routes | Calling a provider SDK from a feature |
| Agent runtime | `nooblyjs-ai-harness`: agent loop, tools, permissions, sandbox (bubblewrap on Linux, seatbelt on macOS), hooks, MCP, skills, memory | Agents outside the harness |
| Tests | `node:test` + `node:assert`, offline with a mock provider; Playwright + axe for screens; live tests opt-in (`*.live.test.js`) | Jest, Mocha, Vitest in new code |
| Identity | Microsoft Entra ID (OIDC) in production; Google sign-in when `AUTH_METHOD=google`; dev person picker, refused in production | A login of each app's own |
| Collaboration | Microsoft Teams bot (Bot Framework, JWT-checked), Outlook through Microsoft Graph | Slack |
| Source and work | Bitbucket Cloud and Jira Cloud, only through the host's devtools service (GET reads; writes through the gate) | Tokens in any hosted app; GitHub Copilot |
| Desktop and browser | Electron window over the host (optional); Edge side-panel extension | A second build of the app |

**No build step.** `npm start` runs the source as written. **Dependencies stay minimal**: `express`, `js-yaml`,
`nooblyjs-core` and the harness as `file:` links, all in the **one root `package.json`**; anything else needs a reason in the PR.

## 2. The repository

```
<workspace>/
├── nooblyjs-core/                  separate repo: services, UI kit and frame, FsStore, the AI module
└── nooblyjs-apps/                  the git repo
    ├── nooblyjs-apps-ai-harness/   the agent runtime and `noobly` CLI (library; beside the solution)
    ├── nooblyjs-apps-ai-desktop/   projects and chat for any LLM (not hosted; beside the solution)
    ├── nooblyjs-apps-blog/, -cms/, -wiki/   other apps
    └── nooblyjs-apps-ai-factory/   NooblyJS: ONE solution, one package.json and one node_modules
        ├── package.json            every dependency of the host and its apps
        ├── app.js, src/, public/, test/, scripts/, workflows/   the host: frame, Home, lifecycle engine, Platform, chat, Teams, devtools
        ├── apps/                   the Electron window, the Edge extension, the Teams app (separate deployables)
        ├── .claude/steering/       this file, factory-product.md, design.md, roadmap.md (the whole factory),
        │                           product.md, tech.md, structure.md (the host and the hosted-app contract)
        └── src/apps/
            ├── product/            Product                    (/product; a Factory section 2026-10-19 to CHG-009)
            ├── design/             Design                     (/design; a Factory section from Phase 16c to CHG-009)
            ├── factory/            Software Factory           (/factory, and the `factory` CLI: npm run factory), with:
            │   └── quality/        its Test section           (/factory/quality)
            ├── infrastructure/     Infrastructure             (/infrastructure)
            ├── security/           Security                   (/security)
            ├── operations/         Operations                 (/operations)
            ├── teammate/           Digital Teammates          (/teammates)
            └── knowledge/          Knowledge (the wiki)       (/wiki; CommonJS .cjs files, Express 4 as `express4`)
```

The git repository is `nooblyjs-apps/`, one level above the solution, so one history covers it and the other apps (this
folder has no `.git` of its own). The root `package.json` links `nooblyjs-core` as `file:../../nooblyjs-core` and the
harness as `file:../nooblyjs-apps-ai-harness`. The host finds each app through `LOCAL_APPS` in `src/hosted-apps.js`. There
is no standalone mode: every app runs inside the host, and its tests run from the root (`npm run test:apps`).

The apps are built from the same template as `src/apps/infrastructure` (the smallest clean one): `index.js` →
`register()`, `src/{routes,services,repos,seed,util}`, `public/js/module.js` and pages on the kit, and `test/` with a
stand-in host (`test/fixtures/host.js`). Security and Operations were built this way in Phases 19 and 22–23. The Test
section uses the same template inside the Factory (`src/apps/factory/<section>/`, its pages in `public/<section>/`, added
to `src/services/sections.js` and `public/js/sections.js`).

## 3. Each project today

Test counts are test files (`*.test.js`, `*.test.mjs`, `*.test.cjs`, `*.test.jsx`, `*.test.ts`), counted 2026-11-17.

| Project | Modules | Runtime dependencies | Tests | Notes |
| --- | --- | --- | --- | --- |
| the host (the root) | ESM | express 5, js-yaml, helmet, compression, express-rate-limit, express-session, passport, nooblyjs-core, AI module | 70 + Playwright e2e | `nodemon` is a dev dependency (Phase 24) |
| `src/apps/product` | ESM | nooblyjs-core | 24 | A hosted app at `/product`. Its Architecture pages show in Design |
| `src/apps/design` | ESM | nooblyjs-core | 3 | A hosted app at `/design` |
| `src/apps/factory` | ESM | express 5 (dev), nooblyjs-ai-harness, AI module, nooblyjs-core, js-yaml | 118, for the line and the Test section | Needs Node 24; event log is daily YAML streams. The Test section is `quality/` (its pages in `public/quality/`) |
| `src/apps/infrastructure` | ESM | nooblyjs-core | 12 | A hosted app at `/infrastructure`; mock provisioner only. Part of the Factory from 2026-10-19 to 2026-10-20 (CHG-005, CHG-007) |
| `src/apps/security` | ESM | nooblyjs-core | 4 | A hosted app at `/security`; mock scanner only |
| `src/apps/operations` | ESM | nooblyjs-core | 4 | A hosted app at `/operations`; mock deployer and monitor only |
| `src/apps/teammate` | ESM | express 5, js-yaml, nooblyjs-core, AI module | 46 | Stores through `host.store` (Phase 24) |
| `nooblyjs-ai-harness` | ESM, `.jsx` via `tsx` | Ink, React, marked, tsx, AI module | 78 | React is for the **terminal** UI only; no browser code |
| `src/apps/knowledge` | **CommonJS** | ~35, including Socket.IO, multer, document converters, `@anthropic-ai/sdk`, `openai`, `@anthropic-ai/claude-agent-sdk` | 96 (Jest and `node:test`) | `.cjs` files; Express 4 (`express4`) behind an Express 5 adapter; generated browser UI; Jest suite is `npm run test:knowledge:jest` |
| `nooblyjs-ai-desktop` | CommonJS | express 5, ejs, bootstrap, marked, dompurify, dotenv, nooblyjs-core, AI module | 13 | Standalone, single user, any provider by design |

### Known variances from the rules

| Variance | Why it exists | What to do |
| --- | --- | --- |
| Knowledge is CommonJS, Express 4, Jest, Bootstrap, many dependencies | It is the legacy Wiki Platform, hosted through an adapter (Phase 8) | Leave it while it works; no new code in that style. Retire the standalone UI when the frame version covers it |
| Knowledge's public pages load CSS and scripts from CDNs (`public/index.html`, `public/css/wiki-ds.css`, `public/js/markdown/`) | Legacy UI, not yet brought in-house | Replace with local copies when the UI is next touched; the browser rule forbids CDNs in new code |
| Knowledge's agents called the Anthropic and OpenAI SDKs directly | Legacy | **Done in Phase 24** (mocking audit A6): the wiki's agents run as teammate tasks (`src/shared/ai/agentTasks.js`). No source file now imports `@anthropic-ai/sdk`, `@anthropic-ai/claude-agent-sdk` or `openai`, but all three are still in `dependencies`: remove them (a code change, not made here) |
| Desktop is CommonJS, uses EJS and Bootstrap, calls any provider | A standalone personal tool, outside governance | Keep it out of the hosted set, or bring it under the rules before hosting it `[CONFIRM]` |
| Harness uses React (Ink) and `tsx` | Terminal UI | Allowed: the "no React" rule is for the browser |
| Node version floors differed: the root `engines` said 24, most projects 22.12, Knowledge 20 | Each project was set up at a different time | **Resolved 2026-11-17 (D12, FIX-019):** `engines` is `>=24` in every project |
| Five unused CommonJS files in `src/utils/` (`fileNaming.js`, `filePolicy.js`, `pathSafety.js`, `fileTypeUtils.js`, `validationMiddleware.js`) | Left behind when the host went ESM | **Resolved 2026-11-17 (D13, FIX-010):** deleted |
| Teammates has its own FsStore | It predated the shared one | **Resolved in Phase 24:** Teammates stores through `host.store` when hosted |
| `nodemon` was a runtime dependency of the host | Oversight | **Resolved in Phase 24:** a dev dependency |

## 4. How the pieces run

- **One process** (`npm start` in the root runs the host on `127.0.0.1:11001`) mounts every enabled app from
  `data/config/hosted-apps.yaml`. Only it writes `data/`.
- **Agent work** is queued with nooblyjs-core queueing and runs in the harness. Today it runs inside the host
  process (Factory runs and teammate tasks), with OS sandboxing on Linux and macOS. Separate workers in containers
  come with a real container runtime.
- **Containers** run over the `ContainerRuntime` interface (simulated today). **Infrastructure** runs over the
  provisioner interface (mock today).
- **Adapters** (`design.md` §9): Security's scanner (`SECURITY_SCANNER`), Operations' deployer and monitor
  (`OPERATIONS_DEPLOYER`, `OPERATIONS_MONITOR`) and the Test section's runner (`TEST_RUNNER`) accept only `mock` today.
  Any other name is refused at start, never silently replaced.
- **Backups**: at the root, `npm run backup` writes a dated, verified copy of `data/` outside it;
  `npm run restore` puts one back.
- **Tests**: `npm test` at the root runs the host's tests and then every app's (`npm run test:host`, `npm run test:apps`),
  offline; the wiki's legacy Jest suite is `npm run test:knowledge:jest`. `npm run test:e2e` runs the host's Playwright and
  axe walk.

## 5. Platform decisions (taken 2026-11-17)

The owner answered these on 2026-11-17 (`.claude/specs/fixes-roadmap.md` Part 0, D1–D11). Until each adapter is built
(Phases 29–32) the mock of each still runs, refused in production from Phase 27.

| Decision | Answer | Blocks until built | Phase |
| --- | --- | --- | --- |
| Where the models run (D1) | **The frontier providers' own APIs** (Anthropic, OpenAI), with the company's keys; no cloud host | Real agents in production (A1, A2) | 29 |
| Container runtime (D2) | **Docker**. Data region `[CONFIRM]` | Real sandboxes, pools, previews (A3, A8) | 30 |
| Cloud and IaC tool (D3) | **Google Cloud**; Terraform suggested, region suggested `europe-west1` `[CONFIRM]` | Real provisioning, drift, cost (A4) | 30 |
| Secret store (D4) | **Docker secrets** (files under `/run/secrets/`; Swarm mode for Docker's managed secrets) | Secrets resolved for runs (A7) | 30 |
| Scanners (D5) | **Gitleaks, Semgrep CE, Trivy, OWASP ZAP** (chosen by Claude at the owner's request) | Real Security scans | 31 |
| Test runner (D6) | **Jest** (with Playwright and `axe-core` for the browser suites) | Real Test runs | 31 |
| Deployment tool (D7) | **GitHub Actions** (`workflow_dispatch` per environment) | Real deployments | 31 |
| Monitoring platform (D8) | **None.** Operations probes health itself; other SLO figures are entered by a person | Measured SLO data | 31 |
| Microsoft 365 (D9) | Suggested: one single-tenant Azure Bot, Graph `Mail.Send` for one mailbox, one on-call channel `[CONFIRM]` a tenant admin | Teams and mail for real | 32 |
| Image registry | `[CONFIRM]` (Google Artifact Registry fits D3) | Real base images and CVEs (B1) | 30 |
| Diagram-as-code format | `[CONFIRM]` | Architecture interchange | — |

## 6. Tools the new stages need (proposed)

Every tool below runs **as a command inside a harness sandbox**, from the repository's base image or a tool image,
behind the adapters in `design.md` §9. None is an npm dependency of a NooblyJS project, so the minimal-dependency
rule holds. The choices were taken on 2026-11-17 (§5); the **Chosen** column says which. The stage names are
the eight of lifecycle version 3 (`product.md` §3.2).

| Need | Stage | Chosen (2026-11-17) | Already in the factory |
| --- | --- | --- | --- |
| Secret scanning | Build | **Chosen: Gitleaks** | `src/apps/factory/src/services/security/secret-scan.js`; the Security mock's `secrets` |
| Static analysis (SAST) | Build | **Chosen: Semgrep CE** | The Security mock's `sast` (no real tool) |
| Dependency and licence scan (SCA) | Build | **Chosen: Trivy** (filesystem mode) | The Security mock's `sca` and `licence`; `npm audit` used by hand in the Phase 13 review |
| SBOM | Build, Release | **Chosen: Trivy** (CycloneDX) | The Security mock's `sbom` |
| IaC scan | Build, Design | **Chosen: Trivy** (config mode) | The Security mock's `iac`; Infrastructure policy checks (own rules) |
| Container image scan | Test, Operate | **Chosen: Trivy** | The Security mock's `image` (returns nothing); CVE status typed into `base-images.yaml` |
| Dynamic scan (DAST) | Test | **Chosen: OWASP ZAP** baseline and API scans | The Security mock's `dast` |
| End-to-end tests | Test | **Chosen: Jest** driving Playwright | Host e2e suite; the Test section's mock runner (`e2e`, `e2e-smoke`) |
| Accessibility tests | Test | **Chosen: Jest** with Playwright and axe-core | Host e2e suite; the Test section's mock runner (`accessibility`) |
| Load tests | Test | **Chosen: Jest** (request-driving tests); k6 if Jest is not enough `[CONFIRM]` | The Test section's mock runner (`load`, a measured p95 from the mock) |
| Resilience tests | Test | **Chosen: Jest**, stopping and restarting Docker containers | The Test section's mock runner (`resilience`) |
| Contract tests | Build | Pact, or schema checks from the API contract | Factory contract-test gate (seed) |
| Monitoring and SLOs | Operate | **None (D8).** Operations' own health probe; other figures entered by a person | Operations' mock monitor (`burn`, `burned`, `measure`) |
| Feature flags and progressive rollout | Release | **GitHub Actions** (D7) runs the rollout; flags `[PLACEHOLDER]` | Operations' mock deployer (`deploy` takes a percentage) |
| Incident paging | Operate | Teams (existing bot and channels) first; a paging tool `[PLACEHOLDER]` | Teams bot |

## 7. Conventions (short)

- **Ids**: typed and global (`PRD-031`, `REQ-031-04`, `ADR-014`, `INF-031`, `REL-…`); see `design.md` §4.
- **Events**: `<thing>.<what happened>` in lowercase, dot-separated, with `_` inside a multi-word name
  (`approval.decided`, `finding.opened`, `outcome_review.closed`, `test_run.recorded`), with `{ actor, itemId, system, at }`
  and, for agent work, `{ teammateId, modelRoute, costUsd }`.
- **Time** from `host.clock`. `Date.now()` appears only as the fallback when no host clock is passed (tests) and to time how long something took (`durationMs`). Lifecycle decisions and events never use it on
  their own.
- **Unknowns**: `[PLACEHOLDER]` for company facts, `[CONFIRM]` for decisions. Never invent them.
- **Words, not colour**: every status has a word. WCAG 2.2 AA, checked by axe.
- **One bug and change log** for every project: `.claude/specs/bugs-and-changes/tasks.md`.
- **Documents follow the Open Knowledge Format (OKF) v0.2** (Google Cloud's spec,
  `github.com/GoogleCloudPlatform/open-knowledge-format`): every document under a `.claude/`, `docs/` or `.docs/` folder,
  and each project's README, CLAUDE and SECURITY file, starts with YAML frontmatter with a `type` (Steering,
  Requirements, Design, Task List, Phase Summary, Roadmap, Runbook, Guide, Audit, Architecture Decision Record,
  Tutorial, Reference…), a `title`, a one-sentence `description` and `tags`. Each folder is a bundle with a generated
  `index.md` that declares `okf_version: "0.2"`; `index.md` and `log.md` are reserved names. `npm run docs:okf` adds what
  is missing (it never overwrites a key or touches a body) and rewrites the indexes; `-- --check` fails on anything out
  of step (`test/okf.test.js`). Seed and data Markdown under `src/` and `data/` is content, not
  documentation, and is not touched.
- **Diagrams in steering and spec documents are Mermaid** (a ```` ```mermaid ```` block: `flowchart`, `sequenceDiagram`,
  `stateDiagram-v2`, `erDiagram`…), never box-and-arrow text drawn with characters. A folder or file layout may stay
  a plain text tree. Keep the words that explain a diagram; a diagram adds to the text, it does not hide a rule.
- **Steering copies**: `npm run steering:sync` (at the root) copies the shared rules into each app's
  `.claude/steering/nooblyjs-ai.md` (and the harness's); `-- --check` fails when one is out of date.
