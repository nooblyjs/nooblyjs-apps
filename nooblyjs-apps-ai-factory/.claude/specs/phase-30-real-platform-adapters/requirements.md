---
type: Requirements
title: 'Phase 30 — Real platform adapters: requirements'
description: The requirements for Phase 30 — Real platform adapters.
tags: [nooblyjs-ai-host, specs, phase-30-real-platform-adapters]
---

# Phase 30 — Real platform adapters: requirements

> **Status: not started (2026-11-17). Decided 2026-11-17:** Docker (D2), Google Cloud with Terraform suggested (D3; region and Terraform to confirm), Docker secrets (D4).
> Root `roadmap.md` Phase 30. Tracker: `../../../../.claude/specs/fixes-roadmap.md` (M-12, M-36, M-19, M-20, M-23).
> Part of Phase 15 (No mocks).

Goal: agent work runs in real containers, Infrastructure provisions real environments, runs get real secrets, and base
images are read from a registry. Each mock adapter is deleted once its real one passes.

## Decisions taken before starting (the defaults)

- **Same interface, new adapter.** Each real adapter implements the interface the mock does today; no route or service
  changes its calls.
- **The mock is deleted when the real one lands**, with its offline test double moved under `test/`.
- **Production applies only through a release** (I10) stays as it is.

## R1 — Container runtime (M-12, M-19; needs D2)

1. THE host SHALL run teammate tasks and Factory runs in containers through a `ContainerRuntime` adapter for Docker (D2)
   runtime, on the repository's base image, with no outbound internet and staging secrets only.
2. Platform · Containers SHALL show real pools, slots, logs and usage, and **Stop** SHALL stop a container.
3. THE pool limits SHALL be enforced by the runtime, not typed into `pools.yaml` (B11).
4. WHEN gate commands would run with no OS sandbox (Windows) outside development, THE Factory SHALL refuse them.
5. THE simulated runtime and the "(simulated)" text SHALL be removed.

## R2 — Provisioner (M-36; needs D3)

1. THE Infrastructure app SHALL provision through a provisioner adapter for Google Cloud with Terraform (D3); generated code
   is a pull request, applied in a sandboxed worker.
2. Drift SHALL be detected from the cloud, and cost read from the cloud's billing data.
3. THE mock provisioner, `INFRA_MOCK_STEP_MS` and the typed-in environments on Platform (B2) SHALL be removed.

## R3 — Secrets (M-20; needs D4)

1. A secret reference (`vault:staging/REDIS_URL`) SHALL resolve through a secret-store adapter at the start of a run,
   handed to that run's sandbox only, never logged, stored or shown.
2. WHEN a reference can't be resolved, the run SHALL refuse to start and say which reference.

## R4 — Base images (M-23; needs a registry and D5)

1. Platform's base images SHALL be read from the image registry, and their CVEs from the image scanner.
2. `data/platform/base-images.yaml` SHALL stop being a source.

## Out of scope

Scanner, test runner, deployer and monitor (Phase 31); Microsoft 365 (Phase 32).
</content>
