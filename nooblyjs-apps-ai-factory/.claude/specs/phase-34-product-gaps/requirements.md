---
type: Requirements
title: 'Phase 34 — Product gaps the steering promises: requirements'
description: The requirements for Phase 34 — Product gaps the steering promises.
tags: [nooblyjs-ai-host, specs, phase-34-product-gaps]
---

# Phase 34 — Product gaps the steering promises: requirements

> **Status: not started (2026-11-17).** Each R starts with a yes/no from the owner (marked `[CONFIRM]`): build it, or take
> it out of the steering. Root `roadmap.md` Phase 34. Tracker: `../../../../.claude/specs/fixes-roadmap.md`
> (FIX-015, FIX-020 to FIX-024).

Goal: every thing the root steering says the factory does is either built or no longer said.

## R1 — Tests for the refusals in Security and Operations (FIX-015)

1. Security SHALL have tests that a Contributor, a Viewer and an agent are refused risk acceptance and threat-model
   acceptance, and that a risk acceptance without a reason or an expiry is refused.
2. Operations SHALL have tests that a production deploy with one approver, the same person twice, or an agent is
   refused, and that an incident can't be declared by an agent.

## R2 — Pen tests (FIX-020): **decided 2026-11-17, take it out**

1. IF built: a pen test is a record on a restricted repository's release (scope, tester, dates, findings that become
   Security findings); a release of a restricted repository needs one closed within the policy window.
2. IF not: `design.md` §11 and `product.md` §3.5 stop naming it. **(Chosen; done.)**

## R3 — Test strategy (FIX-021) `[CONFIRM]`

1. IF built: a test strategy per product (levels, environments, what a person checks) that the test agent reads when
   drafting a story's test analysis.
2. IF not: `product.md` §2 says it is not planned.

## R4 — Signals from SLO breaches and outcome reviews (FIX-022)

1. WHEN an SLO's error budget is exhausted, Operations SHALL raise a signal into Product, linked to the release and item,
   as incidents do.
2. WHEN an outcome review closes with goals not met, Operations SHALL raise a signal.

## R5 — Knowledge write-back (FIX-023)

1. WHEN an ADR, a threat model or a post-incident review is accepted, its page SHALL be written to the wiki (Acme Space,
   a folder per kind), linked back to its record; a newer version updates the page.

## R6 — Skills for the new stages (FIX-024) `[CONFIRM]`

1. THE seed SHALL define `threat-modelling`, `test-writing`, `accessibility`, `dependency-audit` and
   `architecture-decision-records` as teammate skills, used by the teammates assigned to those kinds (Phase 33 R1); or
   `design.md` §6 stops naming them.
</content>
