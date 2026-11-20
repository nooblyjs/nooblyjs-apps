---
type: Design
title: 'Phase 32 — Microsoft 365 and the write gate for real: design'
description: The design for Phase 32 — Microsoft 365 and the write gate for real.
tags: [nooblyjs-ai-host, specs, phase-32-microsoft-365-for-real]
---

# Phase 32 — Microsoft 365 and the write gate for real: design

> **Status: not started (2026-11-17). Blocked on D9 (a tenant admin to register the bot; see the tracker's Part 0).** Requirements: `requirements.md`.

## Tenant steps (outside the code; from Phase 12's runbook)

1. Register the bot (`apps/msteams/noobly-bot`), set `TEAMS_BOT_APP_ID` and its secret (through the secret store,
   Phase 30 R3, when it exists).
2. Grant `Mail.Send` and `User.Read`; set `AZURE_AD_READ_PROFILE=true`.
3. Create the on-call channel, add the bot, set `TEAMS_ONCALL_CONVERSATION`.

The code paths already exist (`src/teams/`, `src/services/notify.js`, `src/services/entra.js`); this phase runs them
for real and fixes what the run finds, each fix a `BUG-NNN` with a failing test first.

## Write gate

`src/services/devtools/writes.js` is unchanged. The run uses a scratch Jira project and a scratch Bitbucket repository
named in `.env`; the Phase 13 test script is followed step by step and its result goes in the summary.

## Removing the stand-ins

| Remove | Where | Replaced in tests by |
| --- | --- | --- |
| Simulator | `src/teams/simulator.js`, `src/routes/dev.js` (34–67), `public/js/pages/dev/teams-simulator.js`, `public/js/pages/dev/adaptive-card.js`, `/css/teams-simulator.css`, the Dev app's `teams` nav (`src/built-in-apps.js:49–53`) | `test/fixtures/bot-connector.js` |
| Dev key | `src/routes/teams.js` (6, 24–57), `src/teams/connector.js` (40–42) | — |
| Playground mock user | `src/teams/bot.js:56`, `src/routes/teams.js:27,49` | — |
| On-call simulator | `src/services/notify.js` (`onCallSimulator`), `src/noobly.js:190–212` | `test/fixtures/graph.js` |

Seed: `src/seed/data/teams/sim/` goes with the simulator.

## Tests

- Unit tests switch to the fixtures; none needs the simulator.
- Live (opt-in): one bot message, one approval card decision, one mail, one on-call alert in the tenant.
- The existing `test:live:devtools` stays read-only; the Send proof is the manual Phase 13 script.
</content>
