---
type: Requirements
title: 'Phase 27 — No mocks in production: requirements'
description: The requirements for Phase 27 — No mocks in production.
tags: [nooblyjs-ai-host, specs, phase-27-no-mocks-in-production]
---

# Phase 27 — No mocks in production: requirements

> **Status: built (2026-11-17), waiting for review.** As built: R4.1 open (separate repo); R4.3 and R4.4 follow D10 (below). Root `roadmap.md` Phase 27. Tracker: `../../../../.claude/specs/fixes-roadmap.md`
> (M-01, M-02, M-05 to M-11, M-32 to M-35). Needs no outside decision (D10 decided 2026-11-17: dev tools stay, refused in production; echo out of the public list).

Goal: a production start can never answer, draft, scan or run with a mock. With no model configured, the system says
so and does nothing; it never plays a script. Mock and fake providers leave the public APIs of the shared libraries.

## Decisions taken before starting (the defaults)

- **`mock` is refused in production everywhere a provider is chosen**, the same way `anthropic` already is. Outside
  production it stays available, but never as a silent default.
- **No default provider.** An unset `AI_PROVIDER` means "no model", not `mock`.
- **Test doubles move to test support**, not deleted: every suite that uses one keeps working.
- **Dev tools (R6) stay for development and are refused in production** (D10): each gets a test proving it.

## R1 — The host has no default provider (M-01)

1. WHEN `AI_PROVIDER` is unset or empty, THE host SHALL start with no model configured (not `mock`).
2. WHEN `NODE_ENV=production` AND `AI_PROVIDER=mock`, THE host SHALL refuse to start with a `ConfigError` naming the
   allowed providers (bedrock, vertex, azure).
3. WHEN no model is configured, THE host SHALL say so on Platform · Settings, in words.

## R2 — Teammates never falls back to the mock in production (M-02)

1. WHEN `NODE_ENV=production`, THE teammates provider choice SHALL never return `MockProvider`, for any model, route or mode.
2. WHEN a task is asked for AND no model is configured for it, THE teammate SHALL refuse the task with a reason
   ("No model is configured for <route>"), and SHALL not bill, post or record a timesheet entry.
3. WHEN `NODE_ENV=production` AND `AI_PROVIDER=mock`, `createProviders` SHALL throw at start.

## R3 — Scripted providers cannot run in production (M-05, M-06)

1. WHEN `NODE_ENV=production`, THE Factory's line SHALL refuse a work item whose agent has a `script`, with a reason.
2. WHEN `NODE_ENV=production`, THE `factory agent --script` and `factory init --script` flags SHALL be refused.
3. THE bench's oracle and null agents SHALL get their scripted providers from the bench's fixtures, not from shipped code.
   *As built:* they stay in the bench (its ceiling and floor) and are refused in production.

## R4 — Mock providers leave the public APIs (M-07, M-08, M-09, M-10, M-11, M-32)

1. THE AI module (`nooblyjs-core`, separate repo) SHALL not list `mock` in `SHARED_TYPES` nor export
   `createMockProvider` from its runtime entry; a test-support entry SHALL export it instead.
2. THE harness SHALL not export `createMockProvider` from `src/index.js`; THE Factory SHALL not re-export it from
   `services/harness.js`.
3. THE harness echo provider SHALL be removed from the provider list users pick from (D10); it stays for tests and the labs.
   *As built:* not offered and refused in production; `noobly --echo` still works in development (the Factory's
   subprocess driver and 17 harness suites use it).
4. THE harness labs SHALL run on a real provider when a key is set and stop with a clear message when none is.
   *As built:* unchanged, by D10 (teaching material under `.claude/learning/`, not shipped).
5. THE desktop app SHALL not ship `scripts/mockProvider.js` nor the `dev:mock` script; its tests keep a fake.
6. THE teammates `live-smoke.js` dry run SHALL move to the test suite.
7. THE Factory SHALL not export `createFakeClock` from `index.js`.

## R5 — Stubs and demo data (M-33, M-35)

1. THE Knowledge workflow steps SHALL receive the real app, or a documented adapter, not a `Proxy` stub.
2. WHEN data is seeded with `seed:blank`, THE seed SHALL write no metrics history and no `mock/scripted` task records.

## R6 — Dev tools are refused in production (M-34)

1. WHEN `NODE_ENV=production`, each of `/dev/teams`, `/dev/clock`, `/dev/styleguide`, the person picker,
   `TEAMS_BOT_DEV_UNSIGNED` and the Teams dev key SHALL be refused or absent, each proved by a test.
2. D10 (keep them, refused in production) is recorded in the summary.

## Out of scope

Removing the scripted answers themselves (Phase 29), the real adapters (Phases 30–32).
</content>
