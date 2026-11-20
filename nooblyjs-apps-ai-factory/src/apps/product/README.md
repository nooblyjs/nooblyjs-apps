---
type: Readme
title: nooblyjs-ai-product
description: An app of its own again since CHG-009 (2026-10-21), hosted at `/product` with its data in `data/product/`.
tags: [nooblyjs-ai-product]
---

# nooblyjs-ai-product

> **An app of its own again since CHG-009 (2026-10-21)**, hosted at `/product` with its data in `data/product/`. From
> 2026-10-19 to 2026-10-21 it was the Software Factory's Product section (`/factory/product`). There is no `server.js`
> or standalone mode: run NooblyJS. Architecture's sidebar row is the Design app's (`/design/architecture`), which draws
> this app's architecture pages. See `CLAUDE.md`.

The **Product Factory** of NooblyJS AI: signals → ideas → specs → architecture (C4 views, ADRs) → UX and UI, with
RICE scoring, a roadmap, readiness checks and drafting agents. A hosted app: the NooblyJS AI host
(`../../..`) imports `index.js` and calls `register()`, which mounts its screens (a UI module in the
host's frame) and its API at `/product/api/v1`. Drafting runs as teammate tasks (`host.service('teammates')`).

```bash
npm install                                        # once, at the solution root
node --test "src/apps/product/test/**/*.test.js"   # this app's tests, offline (npm run test:apps: every app)
```

To run it, run NooblyJS (`npm start` at the solution root): it is on the rail as Product, before Design and the
Factory.

Needs Node 24 and `nooblyjs-core` beside the `nooblyjs-apps` repo (the root `package.json` links it as `file:../../nooblyjs-core`). How it is built: `CLAUDE.md` and
`.claude/steering/` (product, structure, tech). Its phase history is `.claude/steering/roadmap-history.md`.
