# Quick Start Guide

The NooblyJS CMS is in early development. Today the service starts the NooblyJS Core services and serves a landing page and these docs. The site, page and publishing features in the [PRD](prd-cms-platform.md) have not been built yet.

## Prerequisites

- Node.js and npm
- A checkout of `nooblyjs-core` next to the `nooblyjs-apps` folder. This app installs it from `../../nooblyjs-core`.

## Install

```bash
npm install
```

npm copies `nooblyjs-core` into `node_modules/` rather than linking it. If you change `nooblyjs-core`, run `npm install` again.

## Run

```bash
npm run dev      # starts on http://localhost:3004
PORT=4000 npm run dev
npm run kill     # stops whatever is listening on port 3004
```

## What's Available

| URL | What it serves |
|-----|----------------|
| `/` | Landing page |
| `/docs/<file>.md` | Raw files from this `docs/` folder |
| `/readme` | The project README |
| `/applications/cms/api/documentation/list` | Docs listed in `docs/published.json` |
| `/applications/cms/api/documentation/:docId` | Markdown for one doc |
| `/services/` | NooblyJS Core service dashboards (sign-in required) |

## Signing In

On first run, the NooblyJS auth service creates an admin account and writes its password to `.noobly-core/data/INITIAL_ADMIN_PASSWORD.txt`. Logs go to `.noobly-core/logs/`. The `.noobly-core/` folder is gitignored.
