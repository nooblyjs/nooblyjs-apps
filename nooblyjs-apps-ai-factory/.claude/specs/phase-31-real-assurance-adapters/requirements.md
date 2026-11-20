---
type: Requirements
title: 'Phase 31 — Real assurance adapters: requirements'
description: The requirements for Phase 31 — Real assurance adapters.
tags: [nooblyjs-ai-host, specs, phase-31-real-assurance-adapters]
---

# Phase 31 — Real assurance adapters: requirements

> **Status: not started (2026-11-17). Waits on Phase 30. Decided 2026-11-17:** Gitleaks, Semgrep CE, Trivy, OWASP ZAP (D5); Jest (D6); GitHub Actions (D7); no outside monitor (D8) (were: scanners, test runner, deployment tool, monitoring
> platform) and on Phase 30 (real environments). Root `roadmap.md` Phase 31. Tracker:
> `../../../../.claude/specs/fixes-roadmap.md` (M-13 to M-16, M-31). Part of Phase 15 (No mocks).

Goal: Security scans for real, the Test section runs real suites in real environments, Operations deploys and watches
production for real. Each mock is deleted and its "mock" notice leaves the screens.

## Decisions taken before starting (the defaults)

- **One adapter per tool**, behind the existing interfaces (`design.md` §9); each runs its tool in a harness sandbox.
- **A deterministic tool decides; a model never passes a check** (`product.md` §6 rule 13), unchanged.
- **DAST reaches only the environment under test**, in Test or Staging, never Production.

## R1 — Scanner (M-13; needs D5)

1. THE Security app SHALL scan with the D5 tools (Gitleaks: secrets; Semgrep CE: sast; Trivy: sca, licence, iac, image, sbom; ZAP baseline: dast) for `secrets`, `sast`, `sca`, `licence`, `iac`, `image`, `dast` and
   `sbom`, through `scan(kind, target, policies)`.
2. Each finding SHALL name its tool and rule; the Phase 19 rules (fix-by, risk acceptance, proof to close) stay.
3. THE mock scanner and every "Mock scanner" text SHALL be removed.

## R2 — Test runner (M-14; needs D6 and Phase 30)

1. THE Test section SHALL run `e2e`, `e2e-smoke`, `integration`, `load`, `accessibility` and `resilience` with Jest (D6; Playwright and `axe-core` inside Jest for the browser suites)
   tools against the environment's real address, through `run(suite, input)`.
2. Results SHALL be what the tool measured (no fixed p95, no baseline counts).
3. Promotion SHALL still wait on that environment's suites passing (Infrastructure's rule).
4. THE mock runner and its notices SHALL be removed.

## R3 — Deployer (M-15; needs D7 and Phase 30)

1. Operations SHALL deploy a release through Infrastructure with GitHub Actions (D7, a `workflow_dispatch` run per environment): `deploy(release, { percent, by })` and
   `rollback(release, { reason, by })`, only after the two-person `deploy` approval.
2. THE mock deployer and its notices SHALL be removed.

## R4 — Monitor (M-16; needs D8)

1. D8 is "no monitoring platform": the mock monitor SHALL be removed. Operations SHALL measure availability itself (a
   health probe of each deployed service) and deploy and incident counts from its own records; any other SLO or goal
   measure SHALL be entered by a person and shown as entered, not measured.
2. Alerts SHALL come from the platform, not from a person burning a budget.
3. THE mock monitor, its `burn()` development control and its notices SHALL be removed.

## Out of scope

Signals from SLO breaches (FIX-022, Phase 34).
</content>
