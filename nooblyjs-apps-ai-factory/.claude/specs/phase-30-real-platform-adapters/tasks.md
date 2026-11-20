---
type: Task List
title: 'Phase 30 — Real platform adapters: tasks'
description: The task list for Phase 30 — Real platform adapters.
tags: [nooblyjs-ai-host, specs, phase-30-real-platform-adapters]
---

# Phase 30 — Real platform adapters: tasks

> **Status: not started (2026-11-17). Decided: Docker, Google Cloud (+ Terraform, region to confirm), Docker secrets.** `[ ]` open · `[~]` in progress · `[x]` done with tests · `[v]` verified by the owner.

- [~] 0. D2 Docker, D3 Google Cloud, D4 Docker secrets taken (2026-11-17); still to confirm: region and Terraform. _Blocker_
- [ ] 1. `ContainerRuntime` adapter for Docker (D2); teammate tasks and Factory runs start containers. _R1.1 · M-12_
- [ ] 2. Platform · Containers from the runtime; Stop works; pool limits enforced. _R1.2, R1.3 · M-12, B11_
- [ ] 3. Factory refuses unsandboxed gate commands outside development. _R1.4 · M-19_
- [ ] 4. Delete the simulated runtime and its "(simulated)" text. _R1.5 · M-12_
- [ ] 5. Provisioner adapter for Google Cloud and Terraform (D3): plan as a pull request, apply in a sandboxed worker. _R2.1 · M-36_
- [ ] 6. Drift from the cloud, cost from billing. _R2.2 · M-36_
- [ ] 7. Delete the mock provisioner and the typed-in environments. _R2.3 · M-36, B2_
- [ ] 8. Secret-store adapter for Docker secrets (D4); resolved at run start; never logged or stored. _R3 · M-20_
- [ ] 9. Base images from the registry; CVEs from the image scanner (with Phase 31). _R4 · M-23_
- [ ] 10. Offline contract tests and opt-in live tests per adapter. _All_
- [ ] 11. Mocking audit A3, A4, A7, A8, B1, B2, B11 closed; `stack.md` §4–§5, `design.md` §9; summary; tracker. _Working agreement_

## Test script

1. Ask a teammate for a task: Platform · Containers shows its container in Docker; Stop ends it.
2. Approve INF-031's design: a pull request with the generated IaC appears; applying it creates the Test environment.
3. A run that needs `REDIS_URL` gets it; no file, log or event contains the value.
4. Platform · Base images shows what the registry holds, with CVEs from the scanner.
</content>
