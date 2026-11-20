---
inclusion: always
type: Steering
title: 'NooblyJS: the shared rules (read this first)'
description: This project is part of NooblyJS AI, an engineering-lifecycle platform (idea → spec → architecture → design → build → ship, where AI agents draft and people decide).
tags: [nooblyjs-ai-host, steering]
---

# NooblyJS: the shared rules (read this first)

> **Generated from the solution root's `.claude/steering/nooblyjs-ai-shared-rules.md` by `npm run steering:sync`. Do not edit
> it here: change the source in the solution root, and run the sync.** This app's other steering files describe only this app.

This app is part of **NooblyJS AI**, an engineering-lifecycle platform (idea → spec → architecture → design →
build → ship, where AI agents draft and people decide). NooblyJS is **one solution**, `nooblyjs-apps-ai-factory/` in the
`nooblyjs-apps` git repo, with one `package.json` and one `node_modules` at its root. The host is the solution root
(`app.js`, `src/`, `public/`, `test/`); the apps it hosts live in `src/apps/<app>/` (product, design, factory,
infrastructure, security, operations, teammate, knowledge). Every path below is from the **solution root**: from an app
folder that is three folders up (`../../../`). `nooblyjs-core` is a separate repo beside `nooblyjs-apps`, linked from
the root `package.json` as `file:../../nooblyjs-core`; the agent harness (`nooblyjs-apps-ai-harness`) is a sibling folder
in `nooblyjs-apps`, linked as `file:../nooblyjs-apps-ai-harness`. The host is the one process: it mounts each app at its
own path and serves one frame (rail, sidebar, chat dock) from the UI kit in `nooblyjs-core/public/ui/`.

## Who owns what

**The solution root owns everything shared.** Read the root's file before you change anything it owns; if this app's
docs disagree with it, the root wins, so fix this app's docs in the same change.

| Shared topic | Where it lives (from the solution root) |
| --- | --- |
| The product: the 8-stage lifecycle, every screen, roles and the permissions matrix, governance rules | `.claude/steering/product.md` |
| Stack, storage, API conventions, agents and model routing, events, config, commands | `.claude/steering/tech.md` |
| **The hosted-app contract** (`register()`, `options.host`, the UI module and `ctx`, CSS scoping) | `.claude/steering/structure.md` §2a |
| **The cross-app services** (`host.service('workflows' / 'teammates' / 'knowledge' / 'product' / 'factory' / 'platform' / 'devtools' …)`) | `.claude/steering/tech.md` §8b |
| **The one roadmap**: every phase for every app, the hosted-app checklist, and the apps' open work | **`.claude/steering/roadmap.md`** |
| **The whole factory across the SDLC**: the eight stages, the new systems, the trace, checks, the target stack | `.claude/steering/{factory-product,design,stack}.md` |
| Why the host owns the shell | `.claude/adr/ADR-001-host-owned-shell.md` |
| Porting an app with its own UI into the frame | `.claude/guides/porting-an-app.md` |

**This app owns only itself:** what it does and its screens (`product.md`), where its code and data live and the
`services` and events it offers (`structure.md`), and its own values for the contract and how it differs from the
default (`tech.md`), all in its own `.claude/steering/`. Work for this app is planned as a phase in the one roadmap,
with its spec in the root's `.claude/specs/`. There is no roadmap here. Bugs and small changes in this app are logged in
the one log, the root's `.claude/specs/bugs-and-changes/tasks.md`, and fixed here.

## The non-negotiables, in brief

- **Stack.** Node.js 24 (the root `package.json`'s `engines` floor), ES modules, Express 5 (`express`, Express 5 route
  syntax). The knowledge app is CommonJS (`.cjs` files) and keeps Express 4 as `express4` for its legacy modules.
  Plain HTML, CSS and JS in the browser: no React, TypeScript, bundler, build step or CSS framework.
  **One `package.json`, at the solution root**: an app has none of its own, and a new dependency goes in the root's,
  with a reason. Apps never import each other: they talk through `host.service(name)` and events.
- **Storage is files.** Markdown with YAML front matter, `.yaml` config, append-only daily YAML streams, written only
  under this app's `dataDir` through `host.store` (FsStore). No SQLite, JSON databases, Mongo or Postgres.
- **Hosted, an app** mounts once under its mount path, never listens on a port, never calls
  `serverManager.initialize()`, never imports another app (`host.service(name)` and events instead), never
  draws the rail or sidebar, and scopes every CSS selector under `[data-module="<name>"]`.
- **Agents propose, people decide.** Agents are capped at the Contributor access role and never merge to `main`,
  approve, accept a decision, or change a guardrail or budget, including from chat, Teams or an API key. Each rule
  has a test that proves it refuses.
- **Everything is accounted for.** Every write is audited (`host.audit`). Every agent action records actor, item,
  system, model route and cost, and is a teammate task (`host.service('teammates').runTask`), checked by
  `host.service('platform').checkAgentWork` first.
- **Models** only through `nooblyjs-core/ai`, on AWS Bedrock, Google Vertex AI or Azure, asked for by work type, never
  by model id. Direct consumer APIs in development only. No GitHub Copilot integrations.
- **Permissions come only from the access role** (Viewer, Contributor, Approver, Architect, Owner). A work role only
  shapes a person's home.
- **Time comes from `host.clock`**, never `Date.now()`, for targets, reminders and "today".
- **Bitbucket and Jira are production systems.** Only NooblyJS's devtools service calls them. It reads with GET, and
  writes only through its write gate, which sends nothing until a deployment, an Owner and a write token allow it
  and has no way to merge or delete. A hosted app holds no token: it asks `host.service('devtools')`. **Tests never
  write to them: use a fake `fetch`.**
- **Tests** use `node:test`, offline by default with a mock provider they ask for (`AI_PROVIDER=mock`); live tests
  are opt-in (`*.live.test.js`). **No mocks in production:** there is no default provider, `mock` and `echo` are refused
  when `NODE_ENV=production`, and with no model an agent refuses the work instead of playing a script (Phase 27).
- **Documents follow the Open Knowledge Format (OKF) v0.2**: frontmatter with `type`, `title`, `description` and
  `tags`; a generated `index.md` per `.claude/` folder. Run `npm run docs:okf` from the solution root after adding a document.
- **Diagrams in steering and spec documents are Mermaid** (```` ```mermaid ```` blocks), not text drawings; a folder
  layout may stay a text tree.
- **Unknowns:** `[PLACEHOLDER]` for company facts, `[CONFIRM]` for decisions to check. Never invent them.
- **Status is said in words**, not colour alone. WCAG 2.2 AA.
