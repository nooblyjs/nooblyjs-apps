---
type: Requirements
title: 'Phase 33 — Settings, not sample data: requirements'
description: The requirements for Phase 33 — Settings, not sample data.
tags: [nooblyjs-ai-host, specs, phase-33-settings-not-sample-data]
---

# Phase 33 — Settings, not sample data: requirements

> **Status: not started (2026-11-17).** R1–R3 need no decision; R4–R6 need the company's real figures and facts; R7 needs
> D10. Root `roadmap.md` Phase 33. Tracker: `../../../../.claude/specs/fixes-roadmap.md` (M-24 to M-30, M-34).

Goal: nothing shown as if it were measured or decided is really a typed-in sample. Who drafts what is a setting;
onboarding names what is really hired and connected; standards, budgets and facts are the company's own.

## Decisions taken before starting (the defaults)

- **Settings live in Platform** (an Owner edits them, audited), next to model routes and budgets.
- **Empty is honest.** Where a fact isn't supplied, the screen says "not set" with who can set it; it never shows a sample.

## R1 — Who drafts each kind of work is a setting (M-24)

1. THE Platform SHALL hold a setting: kind of work (spec, architecture, UX, UI, infrastructure design, test analysis,
   application architecture, threat model, post-incident review) → a hired teammate.
2. THE Product, Infrastructure, Factory, Test section and Security apps SHALL read it, instead of the slugs written in
   code (`ada-quill`, `rhea-voss`, `design-agent`, `ui-agent`, `ines-tau`, …).
3. WHEN no teammate is assigned for a kind, the draft action SHALL say "Nobody is assigned to draft <kind>" and who can
   assign one.

## R2 — Onboarding names what is real (M-25)

1. Onboarding copy SHALL name the teammates assigned in R1 and the tools actually connected.
2. First-week tasks SHALL come from what is waiting for that person, not from seed item ids.

## R3 — The "For you" tile with no source (M-30)

1. "New signals" SHALL count the Product signals new since the person last looked, or the tile SHALL be removed.

## R4 — Standards, accessibility rules, readiness checks (M-26)

1. They SHALL start empty on a blank install and be edited by an Architect in the app, audited.
2. The sample values stay in the sample story only.

## R5 — Budgets, model routes, guardrails, rates (M-27, M-28)

1. On a blank install they SHALL start empty, with a blocking "set by an Owner" message where a value is needed before work can run.
2. Teammate rates SHALL be the agreed ones; until then the billing screens say "rate not set".

## R6 — Company facts (M-29)

1. Each `[PLACEHOLDER]` in `data/config/organisation.yaml` and Platform's files SHALL be supplied or shown as "not set".

## R7 — Dev-only tools (M-34, needs D10)

1. Per D10 (decided 2026-11-17: stay, refused in production), `/dev/clock`, `/dev/styleguide` and the person picker SHALL either move out of shipped code, or stay
   refused in production with Phase 27's tests.
</content>
