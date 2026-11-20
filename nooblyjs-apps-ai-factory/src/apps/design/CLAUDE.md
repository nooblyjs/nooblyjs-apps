---
type: Agent Instructions
title: CLAUDE.md
description: Guidance for Claude Code in this repository.
tags: [nooblyjs-ai-design]
---

# CLAUDE.md

Guidance for Claude Code in this repository.

`nooblyjs-ai-design` is NooblyJS's **Design** app (Phase 16c, root `product.md` §3.2a): from an item's Product handoff
it writes the **business requirements** (`BR-031-01`, each quoting the spec, accepted by a person with
`accept-requirement`), the **solution architecture** (impacted systems from Platform's repositories with their owning
team, NFRs from the NFR catalogue and the quality attributes, the feature landscape), the **functional analysis**
(interfaces with both sides named, technical requirements per system) and the **stories** (`STORY-031-1`) that build
each feature. Each story is a lifecycle item of its own and goes to Engineering with its own Design handoff. Product
feeds Design, and Design feeds the Software Factory.

| | |
| --- | --- |
| Where it answers | `/design` (rail label Design, icon `pen`; API at `/design/api/v1`; pages in `public/`) |
| Who mounts it | NooblyJS, from `hosted-apps.yaml`, after Product and before the Factory. It was a section of the Factory (`/factory/design`) until CHG-009 (2026-10-21); the host's `foldData` moved `data/factory/design/` to `data/design/` once |
| Its data | `data/design/`: `nfr-catalogue.yaml` (each category with its `prompt` since Phase 18; Product's NFR walk reads it through the `nfrCatalogue` service), `items/<itemId>/design.md` |
| What other apps call | `host.service('design')`: `readinessFacts`, `designFor`, `items`, `acceptRequirement`, `trace` (NooblyJS Phase 16f), `nfrCatalogue` |
| What it calls | `workflows` (items, `syncStories`, `handoffStory`), `product.designInputs`, `platform.repositories`, `teammates.runTask`, `knowledge.find` |

- `index.js`: `register()`, `NAV`. `src/repo.js`: the files. `src/services/design.js`: the rules. `src/services/drafts.js`:
  the scripted drafts (pure functions). `src/services/drafter.js`: who drafts, as a teammate task. `src/routes.js`: the API.
- **The Architecture rows are the Product app's pages** (moved under Design in Phase 16b). `public/js/product-pages.js`
  loads them from `/product/js/pages/` and draws each in Product's scope (`data-module="product"`, with
  `/product/css/product.css` among this app's styles), with a ctx whose API is `/product/api/v1` and whose links are
  Product's; navigation stays this app's (`/design/architecture/<id>`). The code and API stay Product's.
- Agents draft; people accept, edit, merge, split and hand off. Agents are refused every acceptance and handoff, in the
  route and in the service, and the refusal is audited.
- A draft only adds what is missing: it never overwrites what a person accepted or edited. Ids are never reused.
- A handed-off story no longer changes here, except one thing (NooblyJS Phase 20): a person changes one acceptance
  criterion (`PATCH /items/:id/stories/:storyId/criteria/:n`, with a reason) until the story is done; it emits
  `design.criterion_changed`, and the Factory's Test section marks that criterion's cases "criterion changed".
- Old `/factory/design/…` addresses land here (the Factory's `public/js/pages/moved-app.js`).

## Part of NooblyJS (read first)

This repo is hosted by **NooblyJS** (`../../..`). Before changing how it starts, serves pages, signs people
in, stores data, emits events or calls models, read `.claude/steering/nooblyjs-ai.md` (the shared rules, imported
below; the full contract is `../../../.claude/steering/structure.md` §2a). The spec it was built from is
`../../../.claude/specs/phase-16c-design-section/`.

@.claude/steering/nooblyjs-ai.md

## Commands

```bash
node --test "src/apps/design/test/**/*.test.js"   # from the solution root (offline, the stand-in host in test/fixtures/host.js); npm run test:apps runs every app
npm start      # from the solution root: NooblyJS, with Design at /design
```

This app is part of NooblyJS, **one solution** (`nooblyjs-apps-ai-factory/`; the solution root is `../../..`): it has no `package.json` of its own and no standalone server. Its dependencies are in the root `package.json` (`nooblyjs-core` as `file:../../nooblyjs-core`), and its tests run from the root.
