---
type: Readme
title: nooblyjs-ai-infrastructure
description: 'NooblyJS Infrastructure: infrastructure designs drafted from an approved architecture, the environments built from them, provisioning runs, drift and cloud cost.'
tags: [nooblyjs-ai-infrastructure]
---

# nooblyjs-ai-infrastructure

NooblyJS **Infrastructure**: infrastructure designs drafted from an approved architecture, the environments built
from them, provisioning runs, drift and cloud cost.

It is a **hosted app** (a micro-frontend) for NooblyJS. NooblyJS (`../../..`) imports `index.js`, calls
`register(app, serverManager, options)`, and this app attaches its API and its UI module under
`/infrastructure`. NooblyJS draws the rail, the sidebar and the chat; this app draws the content area.

- What it does and shows: `.claude/steering/product.md`
- Platform rules and the `register()` contract: `.claude/steering/stack.md`
- Layout, API, data and events: `.claude/steering/structure.md`
- **Progress:** NooblyJS's roadmap, `../../../.claude/steering/roadmap.md` ("Hosted apps: open work"); history in `docs/roadmap-history.md`

## Run it

From the solution root (`../../..`), which has the one `package.json` for the host and every app:

```bash
npm install                                               # once, at the solution root
npm start                                                 # NooblyJS, with Infrastructure at /infrastructure
node --test "src/apps/infrastructure/test/**/*.test.js"   # this app's tests, offline: mock provisioner, stand-in host
```

There is no standalone mode (removed 2026-11-18). Everything the app stores is a readable file under
`data/infrastructure/` in NooblyJS's data folder; it seeds the INF-031 story there on the host's first start.

## Not yet

It is hosted by NooblyJS at `/infrastructure` (NooblyJS Phase 9a). There is no real provisioner yet (only `mock`), and the
drafting agent is not wired up. See the roadmap.
