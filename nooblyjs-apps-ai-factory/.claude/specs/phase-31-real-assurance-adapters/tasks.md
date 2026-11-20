---
type: Task List
title: 'Phase 31 — Real assurance adapters: tasks'
description: The task list for Phase 31 — Real assurance adapters.
tags: [nooblyjs-ai-host, specs, phase-31-real-assurance-adapters]
---

# Phase 31 — Real assurance adapters: tasks

> **Status: not started (2026-11-17). Waits on Phase 30 (D5–D8 decided: Gitleaks, Semgrep, Trivy, ZAP; Jest; GitHub Actions; no outside monitor).** `[ ]` open · `[~]` in progress · `[x]` done with tests · `[v]` verified by the owner.

- [~] 0. D5–D8 taken (2026-11-17): Gitleaks, Semgrep CE, Trivy, ZAP; Jest; GitHub Actions; no outside monitor. Waiting: Phase 30 environments real. _Blocker_
- [ ] 1. Scanner adapters for each kind; findings name tool and rule. _R1.1, R1.2 · M-13_
- [ ] 2. Delete the mock scanner and every "mock scanner" text. _R1.3 · M-13, M-31_
- [ ] 3. Test runner adapters for each suite, against the environment's address. _R2.1, R2.2 · M-14_
- [ ] 4. Promotion still waits on real results; delete the mock runner and its notices. _R2.3, R2.4 · M-14, M-31_
- [ ] 5. Deployer adapter through Infrastructure, after the two-person approval. _R3.1 · M-15_
- [ ] 6. Delete the mock deployer and its notices. _R3.2 · M-15, M-31_
- [ ] 7. Monitor adapter for SLO burn, measures and alerts. _R4.1, R4.2 · M-16_
- [ ] 8. Delete the mock monitor and the `burn()` control. _R4.3 · M-16, M-31_
- [ ] 9. Unset adapter variable in production is a start-up error. _All_
- [ ] 10. Contract tests offline; live tests opt-in; the end-to-end story. _All_
- [ ] 11. Mocking audit A12–A15 closed; `stack.md` §6, `design.md` §9; summary; tracker. _Working agreement_

## Test script

1. A PR on the fixture repository: Security shows findings from the real tools, each naming tool and rule.
2. Its preview runs real e2e and accessibility suites; a failing journey blocks promotion.
3. Release the feature: two people approve; the real tool deploys to 10%, then 100%; rollback works.
4. SLOs read burn from the monitoring platform; no "mock" text remains on any Security, Test or Operations page.
</content>
