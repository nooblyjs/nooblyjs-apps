---
type: Design
title: 'Phase 28 — Hygiene and the clock: design'
description: The design for Phase 28 — Hygiene and the clock.
tags: [nooblyjs-ai-host, specs, phase-28-hygiene-and-clock]
---

# Phase 28 — Hygiene and the clock: design

> **Status: not started (2026-11-17).** Requirements: `requirements.md`.

## R1 — Removals

| Remove | Check first | Proof |
| --- | --- | --- |
| `nooblyjs-ai-host/src/utils/{fileNaming,filePolicy,pathSafety,fileTypeUtils}.js` | `grep -rn` for each name across the monorepo and `nooblyjs-core` (found none on 2026-11-17) | host `npm test` |
| `@anthropic-ai/sdk`, `@anthropic-ai/claude-agent-sdk`, `openai` from `nooblyjs-ai-knowledge/package.json` | `test/agent-tasks.test.mjs` mentions them: confirm it only asserts they are *not* called; the standalone wiki path (A6 note: "standalone, the wiki still calls the agent's provider") must not need them | knowledge `npm test`; `npm start` standalone |

If the standalone wiki does still need a provider SDK, R1.2 becomes "move it to an optional dependency the standalone
start loads lazily", and the finding goes in the summary.

## R2 — Words

- `scripts/seed.js` line 2: "moves DATA_DIR aside (never deleted), then writes the whole seed".
- Host `CLAUDE.md`, Commands: same wording for `npm run seed -- --reset`.
- Root `README.md`: two rows, same shape as Infrastructure's (mount path, standalone port 11009 and 11010, mock adapter).
- Host steering review: run the reference checker used on 2026-11-17 (backticked paths must exist), then read each
  claim of "built", each service and event name and each count against the code. Fix the docs, not the code, unless
  the code is the bug (then log a `BUG-NNN`).

## R3 — `accept-release-candidate`

Search `data/workflows/` of a seeded install and the seed for the name; if nothing references it, remove it from
`src/middleware/roles.js` (line 14) and its comment (line 8). If something does, migrate those records to
`sign-off-tests` once, audited, the way legacy stage keys were migrated in Phase 16b.

## R4 — Vendoring

Each CDN reference in `nooblyjs-ai-knowledge/public/index.html`, `public/content-review.html`,
`public/css/wiki-ds.css`, `public/services/authserver/invalid.html` and `public/js/markdown/markdown-parser.js` gets a
local copy under `public/vendor/<lib>@<version>/`, the pattern `public/vendor/mermaid` already uses. Versions are pinned
to what the CDN URL names today. The CSP (`nooblyjs-core/src/shared/utils/contentSecurityPolicy`) then drops the CDN
hosts for `/wiki`.

## R5 — The clock

The pattern to remove is `host.clock?.now?.() ?? Date.now()` (and `Number(...)` around it). Files, from the 2026-11-17
grep: `nooblyjs-ai-product/src/services/{portal,loop,feedback,estimate,planning,elicitation,objectives,business-cases}.js`,
`nooblyjs-ai-design/src/services/design.js`, `nooblyjs-ai-operations/src/services/{notes,evidence}.js`,
`nooblyjs-ai-factory/src/services/{hosted,engineering/architecture}.js`.

- Each app's `register()` checks `host.clock?.now` once and throws `Error('<app> needs host.clock …')`.
- Each service takes `now` from the clock it is handed; nothing reaches for the global.
- Standalone `server.js` files already build a host; they pass a system clock explicitly.
- Seeds (`src/seed/index.js` `now = () => Date.now()` defaults) take the clock from the caller.
- Durations (`durationMs`, git lock waits, the Factory's file lock) keep `Date.now()`, and get a comment saying so.

A test per app: `register()` without a clock throws; with the dev clock moved a day, a new record's `at` moves a day.

## R6 — Node floor

After D12, set `engines.node` in every `package.json` and the root; update `stack.md` §1 and §3.

## Order

R1, R2, R3 first (small, independent PRs). R4 next. R5 after D11, one PR per app. R6 after D12.
</content>
