---
type: Task List
title: 'Phase 28 — Hygiene and the clock: tasks'
description: The task list for Phase 28 — Hygiene and the clock.
tags: [nooblyjs-ai-host, specs, phase-28-hygiene-and-clock]
---

# Phase 28 — Hygiene and the clock: tasks

> **Status: in progress (2026-11-17). Tasks 1 and 10 done.** `[ ]` open · `[~]` in progress · `[x]` done with tests · `[v]` verified by the owner.

- [x] 1. Deleted the four unused CommonJS files in `nooblyjs-ai-host/src/utils/`, and `validationMiddleware.js` (also unused); the `CLAUDE.md` sentence updated. _R1.1 · FIX-010_
- [ ] 2. Remove the unused provider SDKs from Knowledge's `dependencies` (or make them lazy and optional for standalone). _R1.2 · FIX-011_
- [ ] 3. `seed.js` header and the host `CLAUDE.md` say `--reset` moves `data/` aside. _R2.1 · FIX-013_
- [ ] 4. Root `README.md`: add Security and Operations. _R2.2 · FIX-017_
- [ ] 5. Host steering review: `product.md`, `tech.md`, `structure.md` against the code. _R2.3 · FIX-018_
- [ ] 6. `pr.recorded` as the preview trigger in every steering mention. _R2.4 · FIX-025_
- [ ] 7. Retire `accept-release-candidate` (or migrate the records first). _R3 · FIX-016_
- [ ] 8. Vendor Knowledge's CDN assets; drop the CDN hosts from its CSP. _R4 · FIX-012_
- [ ] 9. D11 taken (yes, 2026-11-17); then per app: `register()` requires `host.clock`; remove the `Date.now()` fallbacks; a test each. _R5 · FIX-014_
- [x] 10. D12 taken (24 everywhere); `engines.node` is `>=24` in every `package.json` and `package-lock.json`; `stack.md` §1, §3, host `tech.md`, the shared rules, Infrastructure `structure.md`, Desktop `PRD.md`. _R6 · FIX-019_
- [ ] 11. `npm test` at the root, offline, green; `steering:sync -- --check` passes. _All_
- [ ] 12. The summary, the tracker ticks. _Working agreement_

## Test script

1. `grep -rn "fileNaming\|filePolicy\|pathSafety\|fileTypeUtils" nooblyjs-ai-host` finds nothing; host tests pass.
2. `npm ls @anthropic-ai/sdk openai` in Knowledge shows neither (or only as optional).
3. Open `/wiki` with CDN hosts blocked in DevTools: the page and its markdown render as before.
4. Move the dev clock forward a day, add a feedback note in Product: its date is tomorrow's.
5. Start Operations standalone without a clock in a test fixture: `register()` throws and names `host.clock`.
</content>
