---
type: Phase Summary
title: 'Phase 27 — No mocks in production: summary'
description: 'The summary of Phase 27 — No mocks in production: what was built, its test script and what is open.'
tags: [nooblyjs-ai-host, phases]
status: draft
---

# Phase 27 — No mocks in production: summary

**Status:** built (2026-11-17), waiting for your review. Spec: `.claude/specs/phase-27-no-mocks-in-production/`
(tasks 2–16 and 18 done; task 1 open; task 17 below). Tracker: `../.claude/specs/fixes-roadmap.md` (M-01, M-02,
M-05, M-06, M-08 to M-11, M-32 to M-35 ticked; M-07 open). Decision D10 applied: the development tools stay, and are
refused in production.

## What is there

| Area | What |
| --- | --- |
| Host config (M-01) | No default `AI_PROVIDER`: unset is "no model". `mock` and `echo` refuse to start when `NODE_ENV=production`, naming what is allowed |
| Teammates (M-02) | The provider choice never falls back to the mock: with no model, `get()` is null and the task is refused (409 `no_model`, `teammate.task_refused`, nothing billed, no timesheet, no work item). `mock` and `echo` throw at start in production. `describe()` says `none` |
| Platform · Settings | Says in words whether a model is configured, offline mode, or which provider answers |
| Factory (M-05, M-06, M-32) | Scripted models refused in production (the line, `factory agent --script`, `factory init --script`, the bench's oracle and null agents); intake ignores scripts in production and waits for a model; `createFakeClock` moved to `test/fixtures/clock.js` |
| Harness (M-08) | `createMockProvider` and `createEchoProvider` only from `nooblyjs-ai-harness/testing.js`; echo is not offered, and is refused in production; `noobly --echo` still works in development |
| Desktop (M-10) | The fake provider is in `test/support/`; `dev:mock` is gone; `npm test` no longer hangs (`--test-force-exit`) |
| Teammates smoke (M-11) | `scripts/live-smoke.js` makes real calls only; its dry run is `test/live-smoke.test.js` |
| Knowledge (M-33) | The workflow workers pass no app instead of a stub; `initializeAIInstances` works without one |
| Dev tools (M-34) | All hang off `NOOBLY_DEV_LOGIN`, refused in production; `test/no-mocks-in-production.test.js` proves each is absent |
| Seed (M-35) | A blank seed writes no metrics history and no `mock/scripted` record (`test/blank.test.js`) |
| Guard | `test/no-mock-imports.test.js` fails when a mock is named in shipped code outside an allowlist with a reason per file |

## The test script

1. `NODE_ENV=production AI_PROVIDER=mock npm start` refuses to start and names bedrock, vertex and azure (a test).
2. With no `AI_PROVIDER` and no key, Platform · Settings says no model is configured; a task is refused with
   "No model is configured, so Ada Quill can't do this"; her timesheet is unchanged (tests).
3. In production a work item with a script waits for a model, and a scripted run is refused (tests).
4. `createMockProvider` is named only in the allowed places (the guard test).
5. In production `/dev/*` answers 404 or sign-in, the person picker is absent, and the clock can't be moved (tests).
   **Not yet walked through in the real app by a person.**

## Tests

Whole monorepo on 2026-11-17, after the change: harness 400 of 401 (1 skipped), Product 178 of 179, Design 19 of 19,
Factory 414 of 419 (4 skipped), Teammates 151 of 155, Infrastructure 57, Security 21, Operations 20, Knowledge 43,
NooblyJS 441 of 442, Desktop 87 of 88. Every failure was failing before this phase: Product's budget step,
Factory's SSE reconnect, four Teammates tests against nooblyjs-core (scheduler, roles, CSP), the host's kit nav
groups, and Desktop's `/services` CSP.

## Still open

- **M-07 (task 1):** the AI module in `nooblyjs-core` still lists `mock` as a shared type and exports
  `createMockProvider`. It is a separate repo whose CLI template and tests use it, and NooblyJS never selects it; it
  needs its own PR.
- The production rule that refuses the Anthropic API stays until Phase 29 applies D1 (direct provider APIs).
- The scripted answers themselves are removed in Phase 29; after this phase they are unreachable in production.
- The adapters (scanner, test runner, deployer, monitor, provisioner) still default to their mocks: Phases 30 and 31.
