---
type: Requirements
title: 'Phase 28 — Hygiene and the clock: requirements'
description: The requirements for Phase 28 — Hygiene and the clock.
tags: [nooblyjs-ai-host, specs, phase-28-hygiene-and-clock]
---

# Phase 28 — Hygiene and the clock: requirements

> **Status: not started (2026-11-17).** Root `roadmap.md` Phase 28. Tracker: `../../../../.claude/specs/fixes-roadmap.md`
> (FIX-010 to FIX-019, FIX-025). D11 (yes), D12 (24) and D13 (delete) were decided 2026-11-17; nothing is blocked.

Goal: remove dead code and unused dependencies, make comments and docs say what the code does, and make every business
time come from `host.clock`.

## Decisions taken before starting (the defaults)

- **Dead code is deleted, not commented out.** Git keeps the history.
- **The orphan utilities go** (D13): the host's `CLAUDE.md` already calls them "unused CommonJS leftovers".
- **`Date.now()` stays only for durations** (`durationMs`, lock timeouts), never for a timestamp that is stored, shown
  or compared with a target (D11: yes, 2026-11-17).

## R1 — Dead code and unused dependencies (FIX-010, FIX-011)

1. THE host SHALL not contain `src/utils/fileNaming.js`, `filePolicy.js`, `pathSafety.js` or `fileTypeUtils.js`.
2. THE Knowledge package SHALL not list `@anthropic-ai/sdk`, `@anthropic-ai/claude-agent-sdk` or `openai` in
   `dependencies` unless a shipped file imports it.
3. WHEN `npm test` runs at the root, all suites SHALL pass after the removals.

## R2 — Comments and docs match the code (FIX-013, FIX-017, FIX-018, FIX-025)

1. THE `scripts/seed.js` header SHALL describe `--reset` as moving `data/` aside, as the code does; so SHALL the host
   `CLAUDE.md` command list ("wipe data/" today).
2. THE root `README.md` SHALL list `nooblyjs-ai-security` and `nooblyjs-ai-operations`.
3. THE host steering (`product.md`, `tech.md`, `structure.md`) SHALL match the code, checked the way the root four were
   on 2026-11-17 (every path, service, event, test count and status).
4. THE steering SHALL name `pr.recorded` as the preview trigger wherever it names one.

## R3 — The retired permission (FIX-016)

1. WHEN no stored check or approval rule names `accept-release-candidate`, THE roles middleware SHALL not list it.

## R4 — No CDN in the browser (FIX-012)

1. THE Knowledge public pages SHALL load every script, stylesheet and font from the app itself.
2. WHEN a page is opened with the network to CDNs blocked, it SHALL render as before.

## R5 — Business time from the clock (FIX-014, needs D11)

1. THE Product, Design, Operations, Infrastructure, Security and Factory services SHALL take their time from
   `host.clock` when hosted, with no `Date.now()` fallback.
2. WHEN an app is registered without a `host.clock`, it SHALL fail at `register()` with a message naming the clock.
3. `Date.now()` SHALL appear in shipped code only for durations and lock timeouts, or in the clock itself.

## R6 — One Node floor (FIX-019; D12 decided 2026-11-17: 24 everywhere)

1. Every `package.json` in the monorepo SHALL state the same `engines.node` floor, and `stack.md` §1 SHALL say it.

## Out of scope

Mocks (Phase 27, 29), product gaps (Phase 34).
</content>
