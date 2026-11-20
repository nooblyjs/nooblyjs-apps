---
type: Readme
title: nooblyjs-ai
description: 'NooblyJS AI as one solution: an engineering-lifecycle platform (idea → spec → architecture → design → build → ship, where AI agents draft and people decide), the host and every app it hosts.'
tags: [nooblyjs-ai]
---

# nooblyjs-ai

**NooblyJS AI**, an engineering-lifecycle platform: idea → spec → architecture → design → build → ship, where AI agents
draft and people decide. It is **one solution**: this folder is the host, the apps it hosts live in `src/apps/`, and
there is one `package.json` and one `node_modules`. One process serves one frame (rail, sidebar, chat dock) from
`nooblyjs-core`'s UI kit and mounts each app through its `register()`.

| Folder | What it is |
| --- | --- |
| the root (`app.js`, `src/`, `public/`) | The host: one process and one frame for every app. Home, the lifecycle engine, onboarding and people, team chat, Platform and governance, Metrics, Microsoft Entra and Teams, Jira and Bitbucket (integrations off until configured) |
| [`src/apps/product`](src/apps/product) | Product: strategy and business cases, signals, ideas, specs with their elicitation, architecture, UX and UI, drafting agents, and the handoff that feeds Design (at `/product`) |
| [`src/apps/design`](src/apps/design) | Design: business requirements, solution architecture, functional analysis and the stories, each handed to Engineering on its own; it shows Product's Architecture pages (at `/design`) |
| [`src/apps/factory`](src/apps/factory) | The Software Factory at `/factory`: Engineering, the **line** (issues in, verified PRs out; also the `factory` CLI) and its **Test section** ([`quality/`](src/apps/factory/quality)) |
| [`src/apps/infrastructure`](src/apps/infrastructure) | Infrastructure: designs, environments, provisioning runs, drift, cloud cost, on a mock provisioner (at `/infrastructure`) |
| [`src/apps/security`](src/apps/security) | Security by design: threat models, scans, findings and risk acceptance (at `/security`) |
| [`src/apps/operations`](src/apps/operations) | Operations: releases, deployments, SLOs and incidents (at `/operations`) |
| [`src/apps/teammate`](src/apps/teammate) | Digital Teammates: hire, configure, budget and bill named AI agents (at `/teammates`) |
| [`src/apps/knowledge`](src/apps/knowledge) | The knowledge repository: wiki, datasources, AI answers with citations, MCP (at `/wiki`) |
| [`apps/`](apps) | The Electron window, the Edge extension and the Teams app (separate deployables) |

## Run it

Needs **Node 24** and [`nooblyjs-core`](https://github.com/nooblyjs/nooblyjs-core) checked out beside the `nooblyjs-apps`
repo (`../../nooblyjs-core` from this folder). Core also holds the AI module every app calls models through:
`nooblyjs-core/ai` (one way to call every model provider, including Bedrock, Vertex AI and Azure; the model catalogue;
cost), at `nooblyjs-core/src/aiservice/common`. The agent harness, `nooblyjs-apps-ai-harness`, sits beside this folder in
`nooblyjs-apps`.

```bash
git clone https://github.com/nooblyjs/nooblyjs-core.git
git clone https://github.com/StephenBooysen/nooblyjs-apps.git
cd nooblyjs-apps/nooblyjs-apps-ai-factory
cp .env.example .env   # NOOBLY_DEV_LOGIN=true gives a dev sign-in picker; AI_PROVIDER=mock needs no key
npm install            # one install for the host and every app
npm run seed           # the sample story into data/ (the fictional Acme Retail)
npm run seed:clear     # DELETES the data folder, leaving system files only (-- --owner you@x.com to sign in)
npm start              # the host, with every app on the rail: http://127.0.0.1:11001
npm test               # the host's tests, then every app's (npm run test:host, npm run test:apps), offline
npm run factory -- --help   # the Software Factory's CLI
```

The apps run only inside the host: there is no standalone server per app. Two more projects sit beside this folder in
`nooblyjs-apps/`: [`nooblyjs-apps-ai-harness`](../nooblyjs-apps-ai-harness) (`noobly`, the agent runtime and AI coding CLI
every agent runs in; `npm run start:harness`) and [`nooblyjs-apps-ai-desktop`](../nooblyjs-apps-ai-desktop) (projects,
documents and chat for any LLM; `npm run start:desktop`).

How it works: `CLAUDE.md`, and the steering docs in [`.claude/steering/`](.claude/steering): `product.md`, `tech.md`,
`structure.md` and `roadmap.md`, and the whole factory across the full lifecycle in `factory-product.md`, `design.md` and
`stack.md`. The shared rules every app follows are in `.claude/steering/nooblyjs-ai-shared-rules.md`, copied into each
app's `.claude/steering/nooblyjs-ai.md` by `npm run steering:sync`.
