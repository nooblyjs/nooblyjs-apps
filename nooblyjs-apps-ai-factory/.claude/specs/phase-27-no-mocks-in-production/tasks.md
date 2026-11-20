---
type: Task List
title: 'Phase 27 — No mocks in production: tasks'
description: The task list for Phase 27 — No mocks in production.
tags: [nooblyjs-ai-host, specs, phase-27-no-mocks-in-production]
---

# Phase 27 — No mocks in production: tasks

> **Status: built (2026-11-17), waiting for the owner's review.** Task 1 is open (a `nooblyjs-core` PR); summary: `../../phases/phase-27-summary.md`. `[ ]` open · `[~]` in progress · `[x]` done with tests · `[v]` verified by the owner.

- [ ] 1. **Open, needs its own PR in the `nooblyjs-core` repo.** NooblyJS never selects core's `mock` type, and core's CLI template and tests use it. `nooblyjs-core`: move the mock provider to a `testing` entry; drop `mock` from `SHARED_TYPES`; keep a deprecated re-export for one release. _R4.1 · M-07_
- [x] 2. Harness: `createMockProvider` and `createEchoProvider` only from `nooblyjs-ai-harness/testing.js` (the harness's own suites already imported the files directly). _R4.2 · M-08_
- [x] 3. Harness: echo is not offered (`OFFERED`, `/provider`), and is refused in production (`refuseOffline`); `noobly --echo` still works in development (D10). _R4.3 · M-08_
- [x] 4. Harness labs: no change. D10 keeps them; they are teaching material under `.claude/learning/`, not shipped. _R4.4 · M-09_
- [x] 5. Factory: drop the `createMockProvider` / `createEchoProvider` re-exports and `createFakeClock`; tests use test support. _R4.2, R4.7 · M-08, M-32_
- [x] 6. Host: no default `AI_PROVIDER`; refuse `mock` in production; Platform · Settings says "No model configured". _R1 · M-01_
- [x] 7. Teammates: production never returns the mock; `mock` mode throws at start in production. _R2.1, R2.3 · M-02_
- [x] 8. Teammates: "no model" refuses the task (409 `no_model`) before billing or timesheets. _R2.2 · M-02_
- [x] 9. Factory line and CLI (one refusal in `loadScriptedProvider`/`scriptedProvider`; intake ignores scripts in production): refuse scripted agents and `--script` in production. _R3.1, R3.2 · M-05_
- [x] 10. Bench: the oracle and null agents stay (they are the bench's ceiling and floor, not stand-ins) and are refused in production. _R3.3 · M-06_
- [x] 11. Desktop: move the mock provider to test support; drop `dev:mock`. _R4.5 · M-10_
- [x] 12. Teammates: move the `live-smoke.js` dry run into the test suite. _R4.6 · M-11_
- [x] 13. Knowledge workflow steps: pass no app (core's aiservice registers routes only when given one); `initializeAIInstances` accepts none. _R5.1 · M-33_
- [x] 14. Seed check: `seed:blank` writes no metrics history and no `mock/scripted` records. _R5.2 · M-35_
- [x] 15. Dev tools (all hang off `NOOBLY_DEV_LOGIN`, refused in production): one production-refusal test each. _R6 · M-34_
- [x] 16. CI grep (`nooblyjs-ai-host/test/no-mock-imports.test.js`, with an allowlist and a reason for each): no mock import outside `test/` and `testing` entries. _All_
- [ ] 17. `npm test` at the root, offline, green; the phase test script in the real app. _All_
- [x] 18. Steering (`stack.md` §4, `design.md` §9), the mocking audit (A1 and part D), the summary, the tracker ticks. _Working agreement_

## Test script

1. `NODE_ENV=production AI_PROVIDER=mock npm start` refuses to start and names bedrock, vertex and azure.
2. `npm start` with no `AI_PROVIDER` and no key: Platform · Settings says no model is configured; asking Ada for a spec
   section says she can't draft it; nothing appears in her timesheet.
3. `NODE_ENV=production` with a work item that has a `script`: the line refuses it, with the reason in Activity.
4. `grep -rn "createMockProvider" --include=*.js` finds it only under `test/` and the `testing` entries.
5. In production, `/dev/teams`, `/dev/clock` and `/dev/styleguide` answer 404 and the person picker is absent.
</content>
