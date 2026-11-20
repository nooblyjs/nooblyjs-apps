---
type: Requirements
title: 'Phase 32 — Microsoft 365 and the write gate for real: requirements'
description: The requirements for Phase 32 — Microsoft 365 and the write gate for real.
tags: [nooblyjs-ai-host, specs, phase-32-microsoft-365-for-real]
---

# Phase 32 — Microsoft 365 and the write gate for real: requirements

> **Status: not started (2026-11-17). Blocked on D9** (suggested 2026-11-17: one single-tenant Azure Bot, Graph `Mail.Send` limited to one mailbox, one on-call channel; waiting on a tenant admin) and write tokens. Root `roadmap.md` Phase 32.
> Tracker: `../../../../.claude/specs/fixes-roadmap.md` (M-17, M-18, M-22, GATE-12). Finishes Phase 12's tenant run and
> Phase 13's pilot; part of Phase 15 (No mocks).

Goal: the Teams bot, approval mail and on-call alerts reach real people in the tenant, and the write gate's Send path
is proved against Jira and Bitbucket. Then the Teams simulator, the Playground mock user and the fake Graph can go.

## Decisions taken before starting (the defaults)

- **Record only stays the default** for Jira and Bitbucket writes (A9 is deliberate); this phase proves Send, it does
  not switch it on.
- **The simulator goes when the tenant works** (D10: the other dev tools stay, refused in production).

## R1 — Teams bot in the tenant (M-17)

1. THE bot SHALL be registered in the tenant and answer in a channel and a meeting, checked by Microsoft's token.
2. Approval cards SHALL work in Teams: Approve and Send back record the decision as on Home · Approvals.

## R2 — Mail (M-17, A11)

1. Approval mail SHALL be sent through Microsoft Graph with `Mail.Send`.
2. WHEN `AZURE_AD_READ_PROFILE=true` and `User.Read` is consented, onboarding SHALL read the job title.

## R3 — On-call (M-22)

1. Alerts SHALL go to the tenant's on-call channel (`TEAMS_ONCALL_CONVERSATION`), with the bot in it.
2. WHEN that variable is unset in production, the host SHALL say so at start and on Platform · Settings.

## R4 — The write gate's Send path (M-18, GATE-13)

1. With `DEVTOOLS_WRITES=true`, an Owner's switch to Send and write tokens, a release's fix version and tag SHALL be
   written to a scratch Jira project and a scratch repository (the Phase 13 test script).
2. No write merges or deletes, as today; tests still never write.

## R5 — Remove the stand-ins (after R1–R3 pass)

1. THE Teams simulator (`src/teams/simulator.js`, `/dev/teams`, its page and CSS), the dev key path in
   `src/routes/teams.js`, the Playground mock user (`TEAMS_BOT_DEV_PERSON`) and `TEAMS_BOT_DEV_UNSIGNED` SHALL be
   removed, unless D10 keeps them as a dev-only tool outside shipped code.
2. THE `onCallSimulator` option in `src/services/notify.js` SHALL be removed.
3. Tests SHALL use a fake Graph and a fake Bot Connector under `test/fixtures/`, as they do for Atlassian.
</content>
