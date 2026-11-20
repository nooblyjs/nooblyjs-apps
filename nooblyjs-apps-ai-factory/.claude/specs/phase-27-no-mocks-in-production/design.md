---
type: Design
title: 'Phase 27 — No mocks in production: design'
description: The design for Phase 27 — No mocks in production.
tags: [nooblyjs-ai-host, specs, phase-27-no-mocks-in-production]
---

# Phase 27 — No mocks in production: design

> **Status: not started (2026-11-17).** Requirements: `requirements.md`.

## Approach

One rule, applied at every place a provider is chosen: **in production, `mock` is a refusal, not a choice.** The
places are few and already known; each one already refuses `anthropic` in production, so the new check sits next to it.

| Where | Today | Change | Req |
| --- | --- | --- | --- |
| `nooblyjs-ai-host/src/config.js:59` | `env.AI_PROVIDER \|\| 'mock'` | `env.AI_PROVIDER?.toLowerCase() \|\| null`; refuse `mock` when `production` (next to the `anthropic` check) | R1 |
| `nooblyjs-ai-teammate/src/services/providers/index.js:31–74` | `mock` returned whenever nothing else is ready | throw at start for `mode === 'mock'` in production; `get(model)` returns `null` (no model) in production instead of `mock`; callers refuse | R2 |
| `nooblyjs-ai-teammate/src/services/invocation.js`, `host-tasks.js` | play `scripted` when provider is `mock` | when `get()` is `null`, refuse with `no_model` (409) before billing | R2 |
| `nooblyjs-ai-factory/src/services/line/stations/common.js:51` | `loadScriptedProvider` when `agent.script` | refuse in production | R3 |
| `nooblyjs-ai-factory/src/controllers/cli/{agent,init}.js` | `--script` flag | refuse in production | R3 |
| `nooblyjs-ai-factory/src/services/bench/runner.js:34–65` | builds scripted providers | take them from `bench/fixtures/` (moved), shipped runner takes providers as input | R3 |
| `nooblyjs-core/src/aiservice/common/providers/{index,mock}.js`, `aiservice/index.js:78` | `mock` is a shared type | move to `nooblyjs-core/src/aiservice/common/testing/mock.js`; export as `nooblyjs-ai-common/testing` | R4.1 |
| `nooblyjs-ai-harness/src/index.js:89`, `src/providers/mock.js` | public export | export from `nooblyjs-ai-harness/testing` | R4.2 |
| `nooblyjs-ai-harness/src/providers/index.js:64`, `echo.js` | an offline provider listed for users | remove from the list (D10; was: or production-refused if D10 keeps it) | R4.3 |
| `nooblyjs-ai-factory/src/services/harness.js:17` | re-exports `createMockProvider`, `createEchoProvider` | drop both; tests import from `nooblyjs-ai-harness/testing` | R4.2 |
| `nooblyjs-ai-factory/index.js:6` | exports `createFakeClock` | move to `test/fixtures/clock.js` | R4.7 |
| `nooblyjs-ai-desktop/scripts/{mockProvider,dev-mock}.js`, `package.json` `dev:mock` | shipped | move the provider to `test/support/`; drop the script | R4.5 |

## Order (the shared library first)

1. `nooblyjs-core`: add the `testing` entry, keep the old export for one change with a deprecation note, release.
2. Harness and Factory: switch imports to the `testing` entries; remove public exports.
3. Host and Teammates: the production refusals and the "no model" path.
4. Factory line, CLI, bench; desktop; Knowledge stubs; the seed check; the dev-tool tests.

Doing the core first keeps every suite green at each step.

## "No model" is a state, not an error page

With no model configured, each place that would draft or answer shows one line and offers nothing: "No model is
configured, so <teammate> can't draft this. An Owner sets one in Platform · Settings." This is the same wording the
seed's empty `scripts.yaml` already uses. The scripted branches themselves stay until Phase 29, but in production they
are unreachable after this phase because no provider is ever `mock`.

## Tests

- `nooblyjs-ai-host/test/config.test.js`: unset `AI_PROVIDER` → no model; `NODE_ENV=production` + `mock` → `ConfigError`.
- `nooblyjs-ai-teammate/test/providers.test.js`: production never returns the mock; `mock` mode throws at start.
- `nooblyjs-ai-teammate/test/controllers/tasks.test.js`: no model → 409 `no_model`, no ledger line, no timesheet.
- `nooblyjs-ai-factory/test/line/script-refused.test.js`: a scripted agent in production is refused.
- `nooblyjs-ai-host/test/dev-tools-production.test.js`: each dev tool refused or absent in production (R6).
- `nooblyjs-ai-host/test/seed-blank.test.js`: no metrics history and no `mock/scripted` records after `seed:blank`.
- Grep check in CI: no `createMockProvider` import outside `test/` and `testing` entries.

## Risks

| Risk | Mitigation |
| --- | --- |
| Many suites import the mock from the public entry | Keep the old export for one release, with a warning; switch suites first |
| A demo machine run with `NODE_ENV=production` loses its scripted answers | That is the point; demos run without `NODE_ENV=production` |
| `nooblyjs-core` is a separate repo | Its change ships first, as its own PR, linked from this phase's summary |
</content>
