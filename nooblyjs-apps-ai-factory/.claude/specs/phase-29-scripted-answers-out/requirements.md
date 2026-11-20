---
type: Requirements
title: 'Phase 29 — Scripted answers out: requirements'
description: The requirements for Phase 29 — Scripted answers out.
tags: [nooblyjs-ai-host, specs, phase-29-scripted-answers-out]
---

# Phase 29 — Scripted answers out: requirements

> **Status: not started (2026-11-17). Ready: D1 decided 2026-11-17, the frontier model APIs are called directly.** Root `roadmap.md` Phase 29.
> Tracker: `../../../../.claude/specs/fixes-roadmap.md` (M-03, M-04, M-21, M-28). Part of Phase 15 (No mocks).

Goal: every agent action is done by a real model through a frontier provider's own API, or not done. The scripted branches
(`mock()`, `scripted`, `scripts.yaml`, the demo repository's scripted agents) leave shipped code and live only in tests.

## Decisions taken before starting (the defaults)

- **The providers' own APIs** (D1): Anthropic and OpenAI called directly with the company's keys. No cloud host (Bedrock, Vertex, Azure) is used.
- **With no model, nothing is produced.** The action says so (Phase 27 wording) and offers nothing else.
- **Scripts become test fixtures**, with the same content, so the tests that read them keep their assertions.
- **The PRD-031 sample story stays** for demos; it runs on a real model or shows "no model".

## R1 — One real model path (M-21)

1. THE AI module SHALL call the provider's own API (Anthropic, OpenAI) with real keys, proved by a live test
   (`*.live.test.js`) that is skipped without them.
2. WHEN `NODE_ENV=production`, the model path SHALL be a direct provider API only (never `mock`, `echo` or a script).
3. THE cost of each call SHALL come from the provider's reported usage, not a catalogue estimate (M-28).

## R2 — No scripted drafts (M-03)

1. THE Product drafting kinds (`draft-kinds.js`, `architecture.js`, `ux.js`, `ui.js`) SHALL have no `mock()` method;
   `drafting.js` SHALL have no scripted path.
2. THE Factory's application architecture, the Test section's analysis and Infrastructure's design draft SHALL have no
   `scripted` fallback; a draft that comes back in the wrong shape SHALL be shown as failed, not replaced.
3. WHEN no model is configured, each SHALL refuse with "no model is configured", record nothing and bill nothing.

## R3 — No scripted chat or Teams answers (M-03)

1. THE host SHALL not seed or read `chat/scripts.yaml` or `teams/scripts.yaml`.
2. THE Teams bot and chat reply SHALL answer through a model, or reply "No model is configured" once and post nothing else.
3. THE wiki's AI panel SHALL answer through a model with citations; with no model it SHALL list the matching sources
   and say it can't answer (it does not compose an answer from source sentences).

## R4 — No scripted Factory agents (M-04)

1. THE Factory SHALL not write the demo repository or scripted agents in production; the demo stays a dev seed.
2. THE `<home>/scripts/` lookup in `intake/handoff.js` SHALL be removed from the production path.

## Out of scope

Adapters other than the model (Phases 30–31).
</content>
