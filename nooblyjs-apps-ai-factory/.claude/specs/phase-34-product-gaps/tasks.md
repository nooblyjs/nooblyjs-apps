---
type: Task List
title: 'Phase 34 — Product gaps the steering promises: tasks'
description: The task list for Phase 34 — Product gaps the steering promises.
tags: [nooblyjs-ai-host, specs, phase-34-product-gaps]
---

# Phase 34 — Product gaps the steering promises: tasks

> **Status: in progress (2026-11-17). Task 4 done (pen tests taken out of the steering).** `[ ]` open · `[~]` in progress · `[x]` done with tests · `[v]` verified by the owner.

- [ ] 1. Security refusal tests. _R1.1 · FIX-015_
- [ ] 2. Operations refusal tests. _R1.2 · FIX-015_
- [~] 3. Owner's answers: pen tests (**take out**, 2026-11-17), test strategy, skills (build or drop). _R2, R3, R6_
- [x] 4. Pen tests taken out: root `product.md` (§2, §3.5, §4, roles), `design.md` §11 and `roadmap.md` no longer name them. _R2 · FIX-020_
- [ ] 5. Test strategy built, or `product.md` §2 says it is not planned. _R3 · FIX-021_
- [ ] 6. Signals from exhausted SLO budgets and failed outcome reviews. _R4 · FIX-022_
- [ ] 7. Knowledge write-back of accepted ADRs, threat models and post-incident reviews. _R5 · FIX-023_
- [ ] 8. The five skills seeded, or `design.md` §6 stops naming them. _R6 · FIX-024_
- [ ] 9. Root `npm test` green; the sample-story checks for R4 and R5. _All_
- [ ] 10. Root steering (`product.md` §2, §3.5; `design.md` §6, §8, §10, §11); summary; tracker. _Working agreement_

## Test script

1. A Contributor tries to accept a risk: refused, and the refusal is in the audit log.
2. One approver tries to deploy to production: refused.
3. Burn an SLO's budget to zero: a signal appears on the Product board, linked to the release.
4. Accept ADR-014: a page appears in the wiki under Decisions, linking back.
</content>
