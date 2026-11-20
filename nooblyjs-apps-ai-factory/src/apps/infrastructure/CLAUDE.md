---
type: Agent Instructions
title: CLAUDE.md
description: Guidance for Claude Code in this repository.
tags: [nooblyjs-ai-infrastructure]
---

# CLAUDE.md

Guidance for Claude Code in this repository.

`nooblyjs-ai-infrastructure` is NooblyJS's **Infrastructure** module: its screens (a UI module in the NooblyJS frame), its API
at `/infrastructure/api/v1`, infrastructure designs, environments, provisioning runs, drift and cloud cost.
Progress is tracked in NooblyJS's one roadmap, `../../../.claude/steering/roadmap.md` ("Hosted apps: open work"): update its checkboxes in the same change as the work. How I0–I6 were built is `docs/roadmap-history.md`.

From 2026-10-19 to 2026-10-20 this was a section of the Software Factory (`src/apps/factory/infrastructure`, at
`/factory/infrastructure`, data in `data/factory/infrastructure`; CHG-005). It is an app of its own again (CHG-007): the
factory is Product, Design, Build and Test, and provisioning infrastructure is something different. NooblyJS moves an
install's `data/factory/infrastructure` back to `data/infrastructure` on its next start.

**NooblyJS Phase 21 (roadmap I8)**: `src/services/previews.js` makes a preview for each pull request the lifecycle
records (`pr.recorded`) on a repository a design serves (the design's `repos`), from that design, and destroys it when the pull request merges (`pr.merged`); the Factory's Test section runs its
suites (`environment.provisioned`) and records them here (`services.recordTests`). `environments.promote()`
(`POST /promotion-paths/:product/promote`) moves what is deployed one step right only when that environment's suites
pass, naming each failing test; Production only through a release. `POST /environments/:name/tests` runs the suites now.

## Part of NooblyJS (read first)

This repo is hosted by **NooblyJS** (`../../..`) at `/infrastructure` (NooblyJS Phase 9a: on the rail as Infra; design
approvals through the lifecycle engine (part of `noobly`, `src/lifecycle/`); the cloud budget from NooblyJS Platform; it owns environments and previews). Before changing how it starts, serves
pages, signs people in, stores data, emits events or provisions anything, read `.claude/steering/nooblyjs-ai.md` (the shared rules, imported below: noobly owns them, and the full contract is `../../../.claude/steering/structure.md` §2a), `.claude/steering/stack.md` (this repo's values and how it differs) and `.claude/steering/structure.md` (the layout). The source of truth
is `../../../.claude/steering/structure.md` §2a. Where anything here conflicts with NooblyJS, NooblyJS wins.

@.claude/steering/nooblyjs-ai.md

## Commands

```bash
npm start      # from the solution root: NooblyJS, with Infrastructure at /infrastructure
node --test "src/apps/infrastructure/test/**/*.test.js"   # from the solution root (offline, mock provisioner); npm run test:apps runs every app
npm run seed   # from the solution root: the host's seed; this app's seed() runs on the host's first start with an empty data/infrastructure/ (npm run seed -- --reset starts the story again)
```

This app is part of NooblyJS, **one solution** (`nooblyjs-apps-ai-factory/`; the solution root is `../../..`): it has no `package.json` of its own and no standalone server. Its dependencies are in the root `package.json` (`nooblyjs-core` as `file:../../nooblyjs-core`), and its tests run from the root.
The mockups the screens were designed from (the original design brief) are not kept in this repo; the built screens are the reference.
