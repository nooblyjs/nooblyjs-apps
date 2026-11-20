---
type: Design
title: 'Phase 29 — Scripted answers out: design'
description: The design for Phase 29 — Scripted answers out.
tags: [nooblyjs-ai-host, specs, phase-29-scripted-answers-out]
---

# Phase 29 — Scripted answers out: design

> **Status: not started (2026-11-17). Ready (D1: the provider APIs directly).** Requirements: `requirements.md`.

## The model path

D1 chose the providers' own APIs, so the cloud-host providers
(`nooblyjs-core/src/aiservice/common/providers/{bedrock,vertex,azure}.js`) are not on the path. The direct Anthropic
provider already runs live (Phase 6); OpenAI is added the same way:

1. A live test per provider in `nooblyjs-core` (one prompt, one tool call, usage read back), skipped without a key.
2. `nooblyjs-ai-teammate/src/services/providers/index.js` picks the provider from `AI_PROVIDER` (`anthropic` or
   `openai`); in production nothing else is accepted.
3. Cost: `invocation.js` records `usage` from the response and prices it from the rate card agreed in M-28, not from
   `discovery.js`'s public catalogue.

## Removing the scripted branches

Every scripted branch has the same shape: `teammates.runTask({ …, scripted: async () => … })`, or a kind's `mock()`.
The removal is mechanical once Phase 27's "no model" refusal exists.

| Where | Remove | Test fixture it becomes |
| --- | --- | --- |
| `nooblyjs-ai-product/src/services/draft-kinds.js` (96, 124), `architecture.js` (520, 556), `ux.js` (249, 272, 303), `ui.js` (270, 289) | `mock()` methods | `nooblyjs-ai-product/test/fixtures/drafts.js` |
| `nooblyjs-ai-product/src/services/drafting.js` (168, 227–265) | the `kind.mock` call and `modelRoute: 'mock'` | (none) |
| `nooblyjs-ai-factory/src/services/engineering/architecture.js` (153–169) | `scripted` and the JSON fallback | `test/fixtures/architecture.js` |
| `nooblyjs-ai-factory/quality/src/services/analysis.js` (159–175), `drafts.js` | `scripted`, `draftAnalysis` in shipped code | `quality/test/fixtures/analysis.js` |
| `nooblyjs-ai-infrastructure/src/services/drafts.js` (36–113) | `scriptedResources` as a fallback (it may stay as a pure "what the architecture adds" helper shown to the person, not as the draft) | `test/fixtures/drafts.js` |
| `nooblyjs-ai-host/src/teams/bot.js` (75, 203–274), the chat reply path, `src/seed/index.js` (40–41) | `scripts.yaml` reads and seeds | `test/fixtures/scripts.js` |
| `nooblyjs-ai-knowledge/src/wiki/knowledge/answers.js` | composing answers from source sentences | its tests |
| `nooblyjs-ai-factory/src/services/hosted.js` (475–484), `intake/demo-repo.js`, `intake/handoff.js` (37) | scripted agents in the hosted seed; the scripts lookup | `test/fixtures/demo-repo/` |

`teammates.runTask` loses its `scripted` parameter last, after every caller stops passing it.

## A wrong-shaped answer

Today a model's draft that isn't JSON falls back to the scripted one ("the scripted draft is used"). After this phase it
is a **failed draft**: shown as such, with the model's text kept for the person, billed (the model did the work), and
offered again. That is honest about cost and stops silent substitution.

## Tests

- Each app's drafting tests switch to the fixtures through an injected provider; none reads a `mock()`.
- `grep -rn "mock()\|scripted:" --include=*.js` outside `test/` finds nothing.
- Live: `npm run test:live:product` drafts one artefact per stage through the provider's API.

## Risks

| Risk | Mitigation |
| --- | --- |
| Demos need a model key | The sample story is for demos with a model; without one it shows "no model", which is true |
| Cost of real drafts in development | Budgets already cap spend per system; the dev budget is set low |
</content>
