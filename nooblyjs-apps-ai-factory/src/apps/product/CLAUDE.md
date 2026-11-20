---
type: Agent Instructions
title: CLAUDE.md
description: Guidance for Claude Code in this repository.
tags: [nooblyjs-ai-product]
---

# CLAUDE.md

Guidance for Claude Code in this repository.

`nooblyjs-ai-product` is NooblyJS's **Product** app (the Product Factory): strategy and business cases, signals, ideas,
specs with their elicitation, architecture (C4 views, ADRs, quality attributes), UX and UI, reviews, the drafting
agents, and the handoff that feeds **Design**. It is hosted at `/product` (rail label Product, icon `product`), before
Design and the Factory on the rail; its API is at `/product/api/v1` and its pages are a UI module in the NooblyJS frame
(`public/js/module.js`).

| | Since CHG-009 (2026-10-21) | 2026-10-19 to 2026-10-21 (CHG-005) |
| --- | --- | --- |
| Where it answers | `/product` (API at `/product/api/v1`) | `/factory/product` |
| Who mounts it | NooblyJS, from `hosted-apps.yaml` | the Factory's `register()` |
| Its data | `data/product/` (moved back from `data/factory/product/` once, by the host's `foldData`) | `data/factory/product/` |
| Its sidebar rows | its own rail item and sidebar | the Factory's sidebar, group Product |
| `host.service('product')` | from this app's `services` | from the Factory's `provides` |

- **Architecture is shown in Design.** Since lifecycle v3 (Phase 16b) Architecture's sidebar row is the Design app's.
  The code, the API (`/product/api/v1/architecture…`, `/adrs…`) and the pages (`public/js/pages/architecture.js`,
  `stage-list.js`) stay here; `../design/public/js/product-pages.js` draws them in this app's scope
  (`data-module="product"`, `css/product.css`, which Design lists among its styles). This app's own `/architecture`
  addresses move on to `/design/architecture` (`public/js/pages/moved.js`), and `adrFor()` links there.
- Old `/factory/product/…` addresses land here (the Factory's `public/js/pages/moved-app.js`).
- The docs in `.claude/steering/` and `docs/` were written when this was first an app of its own (before 2026-10-19):
  where they mention `server.js` or standalone mode, those are gone; run NooblyJS.

## Part of NooblyJS (read first)

This repo is hosted by **NooblyJS** (`../../..`). Before changing how it starts, serves pages, signs people
in, stores data, emits events or calls models, read `.claude/steering/nooblyjs-ai.md` (the shared rules, imported
below: the host owns them, and the full contract is `../../../.claude/steering/structure.md` §2a). This
app's own scope is `.claude/steering/product.md`, its layout `.claude/steering/structure.md`, its values
`.claude/steering/tech.md`. What is open is in the one roadmap, `../../../.claude/steering/roadmap.md`.

@.claude/steering/nooblyjs-ai.md

## Commands

```bash
node --test "src/apps/product/test/**/*.test.js"   # from the solution root (offline, mock provider, the stand-in host in test/fixtures/host.js); npm run test:apps runs every app
npm start      # from the solution root: NooblyJS, with Product at /product
```

This app is part of NooblyJS, **one solution** (`nooblyjs-apps-ai-factory/`; the solution root is `../../..`): it has no `package.json` of its own and no standalone server. Its dependencies are in the root `package.json` (`nooblyjs-core` as `file:../../nooblyjs-core`), and its tests run from the root.
