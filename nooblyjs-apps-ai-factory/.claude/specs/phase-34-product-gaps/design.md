---
type: Design
title: 'Phase 34 — Product gaps the steering promises: design'
description: The design for Phase 34 — Product gaps the steering promises.
tags: [nooblyjs-ai-host, specs, phase-34-product-gaps]
---

# Phase 34 — Product gaps the steering promises: design

> **Status: not started (2026-11-17).** Requirements: `requirements.md`.

## R1 — Tests

Add to `nooblyjs-ai-security/test/` and `nooblyjs-ai-operations/test/` using each app's `test/helpers.js` `startApp`.
Each refusal asserts the status code, the error code and the audit line, the pattern the host's governance tests use.
No code change unless a test fails, in which case it is a `BUG-NNN`.

## R2 — Pen tests (not built: the owner chose to take them out, 2026-11-17; kept for the record)

- Security: `data/security/pen-tests/PEN-<n>.md` (front matter: release, repos, tester, from, to, state), a Pen tests
  page in Security's nav, findings raised through `findings.open` with `kind: pentest`.
- A check of kind `review` (`key: pen-test-closed`) on a restricted repository's release, from `checksFor`.

## R3 — Test strategy (if confirmed)

- The Test section: `data/factory/quality/strategies/<product>.md` (levels, environment kinds, the person's checks).
- `analysis.js` reads the product's strategy into the test agent's brief; the Engineering sign-off shows which strategy
  applied.

## R4 — Signals

`nooblyjs-ai-operations/src/services/slos.js` and `outcomes.js` call `svc('product')?.raiseSignal(…)` the way
`incidents.js:70` does, with `source: 'slo'` or `'outcome-review'`, and emit `signal.raised`.

## R5 — Write-back

A listener in Knowledge's hosted bridge (`src/hosted/platform.cjs`) on `adr.accepted`, `threat_model.accepted` and
`incident.review_accepted` fetches the record through `host.service(...)` and writes a page through the wiki's own
document service, under `Acme Space/Decisions`, `Threat models` and `Post-incident reviews`. Personal data is redacted
on the way in, as imports are.

## R6 — Skills (if confirmed)

Skill files in the teammate seed (`nooblyjs-ai-teammate/src/config/seed-data.js`), each a short how-to the teammate
loads; assigned by kind through Phase 33's setting.

## Tests

One test per R; R4 and R5 also in the sample story (an SLO burn raises a signal on the board; an accepted ADR appears in
the wiki).
</content>
