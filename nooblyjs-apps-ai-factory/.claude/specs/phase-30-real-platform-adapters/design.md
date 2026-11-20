---
type: Design
title: 'Phase 30 — Real platform adapters: design'
description: The design for Phase 30 — Real platform adapters.
tags: [nooblyjs-ai-host, specs, phase-30-real-platform-adapters]
---

# Phase 30 — Real platform adapters: design

> **Status: not started (2026-11-17). Decided: Docker, Google Cloud (+ Terraform, region to confirm), Docker secrets.** Requirements: `requirements.md`.

## Pattern (from `design.md` §9)

One interface in `src/<kind>/`, a real adapter chosen by configuration and refused without credentials, no tool or
cloud SDK called from a route or service, and the tool itself run inside a harness sandbox. The mocks already sit
behind these seams, so this phase adds adapters and then deletes mocks.

| Adapter | Interface today | Real adapter (after the decision) | Mock to delete |
| --- | --- | --- | --- |
| Container runtime | `nooblyjs-ai-host/src/services/platform/containers.js` (pools from `pools.yaml`) | `containers/<runtime>.js` for D2 (Docker or Kubernetes) | the simulated runtime; `pools.yaml` slot counts |
| Provisioner | `nooblyjs-ai-infrastructure/src/provisioners/index.js` (`createProvisioner({ name })`) | `provisioners/<tool>.js` for D3 (Terraform, OpenTofu, …) | `provisioners/mock.js`; `INFRA_MOCK_STEP_MS`; cost and drift estimates in `services/cost.js`, `drift.js` |
| Secret store | `nooblyjs-ai-host/src/services/platform/index.js` (references only) | `secrets/docker.js` (reads `/run/secrets/`, D4) | none today: the change is resolution |
| Image registry | `data/platform/base-images.yaml` | `registry/<registry>.js`, CVEs via Phase 31's image scanner | the typed-in file |

## Container runtime

- `ContainerRuntime.start({ image, task, secrets, network: 'none', limits })`, `stop(id)`, `logs(id)`, `usage()`.
- Teammate tasks (`teammates.runTask`) and Factory runs (`exec/sandbox.js`) ask the runtime instead of running in the
  host process; Platform's `checkAgentWork` still runs first.
- The Windows guard (R1.4) lives in `nooblyjs-ai-factory/src/services/exec/sandbox.js`: no OS sandbox and not
  development → refuse.

## Provisioner

- `plan(design, environment)` → a pull request with the generated IaC on the infrastructure repository (through the
  devtools write gate); `apply(plan)` runs in a sandboxed worker with the cloud credentials from R3; `observe()`
  feeds drift; `cost(month)` reads billing.
- Production still applies only through an Operations release with two approvals (I10).

## Secrets

Resolution happens at run start in the runtime adapter: the reference list comes from the repository's settings; the
values go into the container's environment and nowhere else. A test proves the value is absent from logs, events,
audit and files.

## Tests

- Each real adapter: an offline contract test against a test double (the old mock, moved to `test/`), and a live test
  skipped without credentials.
- Host: Containers page shows the runtime's pools; Stop stops one (live).
- Infrastructure: a preview environment is created and destroyed for real (live).
- Secrets: a run sees `REDIS_URL`; `grep` of `data/` and logs finds no value.

## Risks

| Risk | Mitigation |
| --- | --- |
| A real cloud costs money in tests | Live tests are opt-in and cleaned up; Platform's cloud budget caps it |
| Runs leave the host process | The harness already runs agents in a subprocess (`exec/harness/subprocess.js`); the runtime wraps that |
</content>
