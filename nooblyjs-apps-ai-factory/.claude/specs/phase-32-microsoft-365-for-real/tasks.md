---
type: Task List
title: 'Phase 32 — Microsoft 365 and the write gate for real: tasks'
description: The task list for Phase 32 — Microsoft 365 and the write gate for real.
tags: [nooblyjs-ai-host, specs, phase-32-microsoft-365-for-real]
---

# Phase 32 — Microsoft 365 and the write gate for real: tasks

> **Status: not started (2026-11-17). Blocked on D9 (a tenant admin to register the bot; see the tracker's Part 0).** `[ ]` open · `[~]` in progress · `[x]` done with tests · `[v]` verified by the owner.

- [ ] 0. D9: the bot registered, `Mail.Send` and `User.Read` granted, the on-call channel made. _Blocker_
- [ ] 1. The bot answers in a channel and a meeting; approval cards decide. _R1 · M-17_
- [ ] 2. Approval mail through Graph; job title read at onboarding. _R2 · M-17, A11_
- [ ] 3. On-call alerts to the tenant channel; a warning when unset in production. _R3 · M-22_
- [ ] 4. The Phase 13 write test script against scratch Jira and Bitbucket. _R4 · M-18, GATE-13_
- [ ] 5. Fixes found by the run, each a `BUG-NNN` with a failing test. _R1–R4_
- [ ] 6. Remove the simulator, dev key, Playground mock user and on-call simulator (per D10). _R5 · M-17, M-22, M-34_
- [ ] 7. Fake Graph and Bot Connector fixtures for the tests. _R5.3_
- [ ] 8. Opt-in live tests for bot, card, mail, alert. _All_
- [ ] 9. Mocking audit A9–A11, A16 closed; tech.md §7.3; Phase 12 and 13 marked fully done; summary; tracker. _Working agreement_

## Test script

1. In Teams, mention the bot in a channel: it answers. In a meeting, it posts notes to the item.
2. An approval card in Teams: Approve; Home · Approvals shows the decision, by you.
3. The approver gets the mail in Outlook.
4. Declare an incident: the on-call channel gets the alert.
5. The Phase 13 script writes a fix version and a tag to the scratch projects, and nothing else.
6. `/dev/teams` answers 404; `grep -rn simulator nooblyjs-ai-host/src` finds nothing.
</content>
