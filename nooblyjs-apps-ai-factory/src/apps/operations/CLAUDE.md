---
type: Agent Instructions
title: CLAUDE.md
description: Guidance for Claude Code in this repository.
tags: [nooblyjs-ai-operations]
---

# CLAUDE.md

Guidance for Claude Code in this repository.

`nooblyjs-ai-operations` is NooblyJS's **Operations** app (root roadmap Phases 22–23, root `product.md` §3.7): its
screens (a UI module in the NooblyJS frame) and its API at `/operations/api/v1`. **Part 1 (Phase 22)** is releases and
deployments: a release is one feature, released on its own once all its stories have passed Test, with an evidence
pack, release notes, a rollout and a rollback; two people give its deploy approval; the **deployer adapter** (only the
mock until a deployment tool is chosen) applies it through Infrastructure. **Part 2 (Phase 23)** is operate and learn:
the item's quality attributes become **SLOs** with error budgets once its first release is live (the **monitoring
adapter**, only the mock until a platform is chosen), alerts go to on call in Teams (NooblyJS's `oncall`), **incidents**
raise a signal on the Product board and get the SRE agent's post-incident review, accepted into Knowledge, and the
**outcome review**, due 30 days after the first release, closes the item through the lifecycle's approval. Progress is
tracked in NooblyJS's one roadmap, `../../../.claude/steering/roadmap.md`; the specs are
`../../../.claude/specs/phase-22-release/` and `phase-23-operate-and-learn/`.

## Part of NooblyJS (read first)

This repo is hosted by **NooblyJS** (`../../..`) at `/operations` (rail label Ops, icon `upload`). Before
changing how it starts, serves pages, signs people in, stores data, emits events or deploys anything, read
`.claude/steering/nooblyjs-ai.md` (the shared rules, imported below: noobly owns them, and the full contract is
`../../../.claude/steering/structure.md` §2a) and `.claude/steering/structure.md` (this repo's layout).
Where anything here conflicts with NooblyJS, NooblyJS wins.

@.claude/steering/nooblyjs-ai.md

## Commands

```bash
npm start      # from the solution root: NooblyJS, with Operations at /operations
node --test "src/apps/operations/test/**/*.test.js"   # from the solution root (offline, mock deployer, a stand-in host); npm run test:apps runs every app
npm run seed   # from the solution root: the host's seed; this app's seed() runs on the host's first start with an empty data/operations/ (npm run seed -- --reset starts the story again)
```

The roadmaps' test scripts run in the real app as `../../../test/release.test.js` and `operate.test.js`
(the Factory, Teammates, Infrastructure, Security, Operations and, for Phase 23, Knowledge hosted).

## Rules this code keeps

- **Production changes only through a release.** Infrastructure refuses anything else and checks the release's
  `deploy` approval itself before the deployer's change lands (I10).
- **Two different people approve a deploy**, each with `deploy-production`, for themselves or on someone's behalf; an
  agent never. The approval is the lifecycle engine's (`ref.app: operations`): Home · Approvals and this app decide it
  the same way (`services.decideApproval`).
- **A release can't carry an open high or critical finding** without an accepted risk (Security's).
- **Nothing pretends to be a real deployment.** The mock deployer says so on every page and on Policies;
  `OPERATIONS_DEPLOYER` other than `mock` is refused at start.
- **Jira and Bitbucket writes go through NooblyJS's write gate** (`host.service('devtools').release.record`), never
  directly; while the gate is closed they are recorded, not sent.
- **Nothing pretends to watch production.** The mock monitor says so on SLOs, outcome reviews and Policies;
  `OPERATIONS_MONITOR` other than `mock` is refused at start; burning a budget by hand is the mock's, for development.
- **People resolve incidents, accept reviews and decide outcome reviews** (`draft`; `approve` for the outcome review,
  also on someone's behalf); the SRE agent drafts.
- **Closing an item withdraws what was never released**: the lifecycle withdraws its stories not yet in Operate when
  its outcome review is approved; the review lists them first.
- **Time is the host's clock** (`host.clock`): an outcome review is due on it (`clock.moved` sweeps).

This app is part of NooblyJS, **one solution** (`nooblyjs-apps-ai-factory/`; the solution root is `../../..`): it has no `package.json` of its own and no standalone server. Its dependencies are in the root `package.json` (`nooblyjs-core` as `file:../../nooblyjs-core`), and its tests run from the root.
