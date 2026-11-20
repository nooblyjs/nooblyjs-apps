---
type: Design
title: 'Phase 33 — Settings, not sample data: design'
description: The design for Phase 33 — Settings, not sample data.
tags: [nooblyjs-ai-host, specs, phase-33-settings-not-sample-data]
---

# Phase 33 — Settings, not sample data: design

> **Status: not started (2026-11-17).** Requirements: `requirements.md`.

## R1 — `data/platform/drafting.yaml`

```yaml
# kind of work → teammate slug (hired in Digital Teammates)
spec: ada-quill
architecture: rhea-voss
ux: design-agent
ui: ui-agent
infrastructure-design: ines-tau
test-analysis: null
application-architecture: null
threat-model: null
post-incident-review: null
```

- `host.service('platform').drafterFor(kind)` → the teammate, or `null`. Validates that the slug is hired.
- Platform · Settings gets a "Who drafts what" table; changes are audited (`platform.drafter_changed`).
- Callers replace their constants: `nooblyjs-ai-product/src/services/{spec-writes,architecture,ux,ui}.js`,
  `nooblyjs-ai-infrastructure` (`agent.yaml` stand-in and `services/drafts.js`), the Factory's
  `engineering/architecture.js`, `quality/src/services/analysis.js`, Security's threat-model draft and Operations'
  post-incident review. Each asks `drafterFor()` and refuses with the R1.3 message when it is `null`.
- The seed writes today's mapping for the sample story; `seed:blank` writes the file with every value `null`.

## R2 — Onboarding

`data/config/work-roles.yaml` keeps the structure; its agent and tool lines become templates filled from `drafterFor()`
and from connected systems (devtools, Teams). First-week tasks come from the person's For you queue at first sign-in.

## R3 — "New signals"

`src/services/for-you.js`: count `host.service('product')` signals with `at` after the person's last visit (stored in
their profile). If Product isn't hosted, the tile isn't shown.

## R4–R6 — Empty is honest

One pattern: the reader returns `{ value: null, setBy: 'Owner' }` and the screen shows "Not set · an Owner sets this in
Platform · Settings". Applies to `standards.yaml`, `accessibility.yaml`, `readiness.yaml` (Architect), `budgets.yaml`,
`model-routes.yaml`, `guardrails.yaml` (Owner), teammate rates, and `organisation.yaml`. Work that needs a budget or a
route is refused while it is unset, with the same message.

## Tests

- Platform: `drafterFor()` with a hired, an unhired and a missing teammate.
- Each drafting app: refuses with the R1.3 message when nobody is assigned.
- `seed:blank` then Platform · Settings: every value says "Not set"; no sample number appears anywhere (axe walk plus a
  text search for the sample figures: `$9,000`, `Node 22, Java 21`).
</content>
