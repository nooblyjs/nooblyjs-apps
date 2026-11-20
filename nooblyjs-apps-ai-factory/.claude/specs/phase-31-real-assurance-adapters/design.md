---
type: Design
title: 'Phase 31 — Real assurance adapters: design'
description: The design for Phase 31 — Real assurance adapters.
tags: [nooblyjs-ai-host, specs, phase-31-real-assurance-adapters]
---

# Phase 31 — Real assurance adapters: design

> **Status: not started (2026-11-17). Waits on Phase 30 (D5–D8 decided: Gitleaks, Semgrep, Trivy, ZAP; Jest; GitHub Actions; no outside monitor).** Requirements: `requirements.md`.

## The four seams (as built, `design.md` §9)

| Adapter | Factory today | Chosen by | Real adapter | Delete with it |
| --- | --- | --- | --- | --- |
| Scanner | `nooblyjs-ai-security/src/scanners/index.js` → `mock.js` | `SECURITY_SCANNER` | `scanners/<tool>.js` per kind, or one per tool covering several kinds (e.g. Trivy for `sca`, `iac`, `image`) | `mock.js`; `mockNote()` in `public/js/lib.js`; the text in `services/{scans,summary,policies}.js`; the Factory evidence wording in `src/services/evidence/bundle.js:124` |
| Test runner | `nooblyjs-ai-factory/quality/src/runners/index.js` → `mock.js` | `TEST_RUNNER` | `runners/<tool>.js` (e.g. Playwright for e2e and a11y with axe, k6 for load) | `mock.js`; `runner = 'mock'` default in `services/runs.js:140` |
| Deployer | `nooblyjs-ai-operations/src/deployers/index.js` → `mock.js` | `OPERATIONS_DEPLOYER` | `deployers/<tool>.js`, calling Infrastructure's `deployRelease` / `rollbackRelease` | `mock.js`; notices on `releases.js`, `deployments.js`, `policies.js` |
| Monitor | `nooblyjs-ai-operations/src/monitors/index.js` → `mock.js` | `OPERATIONS_MONITOR` | `monitors/<platform>.js` | `mock.js`; the `burn()` control on `slos.js` |

Each `index.js` keeps its "refuse any unknown name at start" rule; the default name becomes the real adapter's, and an
unset variable in production is a start-up error (no silent default).

## Running tools

Scanners and runners run as commands in a harness sandbox on the repository's base image (Phase 30 runtime). Their
images carry what they need; rule feeds and registries are allow-listed like package registries (`design.md` §12).
DAST and the test runner get one allowed address: the environment under test.

## Results into the one check shape

No change to the shape (`design.md` §5): `verifiedBy` becomes the real tool's name (`semgrep`, `trivy`, `playwright`,
`k6`), `evidence.summary` the tool's own numbers. Existing `checksFor` services map them as today.

## Tests

- Per adapter: an offline contract test using the old mock, moved to `test/`, as the double; a live test against a
  fixture repository or a scratch environment, skipped without the tool.
- One end-to-end story: a PR on a fixture repository gets real findings, a real e2e run in its preview, a real deploy
  to Staging, and a real SLO read.

## Risks

| Risk | Mitigation |
| --- | --- |
| Real scanners find many issues on day one | Policies already set which severities block; start with warnings, then raise |
| Load tests against shared environments | Only in the environment kind the policy names (Staging), on a schedule |
</content>
