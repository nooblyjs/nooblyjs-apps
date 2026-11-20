---
type: Task List
title: 'Phase 29 — Scripted answers out: tasks'
description: The task list for Phase 29 — Scripted answers out.
tags: [nooblyjs-ai-host, specs, phase-29-scripted-answers-out]
---

# Phase 29 — Scripted answers out: tasks

> **Status: not started (2026-11-17). Ready (D1 decided).** `[ ]` open · `[~]` in progress · `[x]` done with tests · `[v]` verified by the owner.

- [x] 0. D1 taken (2026-11-17): the frontier model APIs, called directly. _Blocker_
- [ ] 1. `nooblyjs-core`: live tests for the Anthropic and OpenAI APIs (prompt, tool call, usage). _R1.1 · M-21_
- [ ] 2. Teammates: a direct provider API as the only production path; cost from reported usage and the agreed rates. _R1.2, R1.3 · M-21, M-28_
- [ ] 3. Product: remove every `mock()` and the scripted path in `drafting.js`; fixtures for tests. _R2.1 · M-03_
- [ ] 4. Factory application architecture: no scripted fallback; wrong shape is a failed draft. _R2.2 · M-03_
- [ ] 5. Test section analysis: no scripted fallback. _R2.2 · M-03_
- [ ] 6. Infrastructure design draft: no scripted fallback. _R2.2 · M-03_
- [ ] 7. Host chat and Teams: no `scripts.yaml`; "No model is configured" reply. _R3.1, R3.2 · M-03_
- [ ] 8. Wiki AI panel: sources listed, no composed answer without a model. _R3.3 · M-03_
- [ ] 9. Factory: demo repository and scripted agents only in the dev seed; drop the scripts lookup. _R4 · M-04_
- [ ] 10. `teammates.runTask` loses its `scripted` parameter. _R2, R3_
- [ ] 11. Root `npm test` offline and green; `npm run test:live:product` through the provider's API. _All_
- [ ] 12. Mocking audit A1, A2 closed; steering; summary; tracker ticks. _Working agreement_

## Test script

1. With a provider key: ask Ada for PRD-031's rollout plan; it is drafted through the provider's API and the cost on her timesheet
   matches the provider's usage.
2. Without credentials: the same request says no model is configured; nothing is drafted or billed.
3. Ask the Teams bot a question with no model: it says so once.
4. Ask the wiki's AI panel with no model: it lists sources and does not answer.
5. `grep -rn "mock()\|scripted:" --include=*.js` outside `test/` finds nothing.
</content>
