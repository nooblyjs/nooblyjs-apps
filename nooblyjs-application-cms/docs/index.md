# NooblyJS CMS Documentation

The NooblyJS CMS is a planned multi-site content management system built on NooblyJS Core. It is in early development. The running service only starts the core services, the landing page and the documentation endpoints.

## Using the App

- [Quick Start](quickstart.md): install, run, and the URLs the service exposes today.

## Planning

These documents describe the CMS we intend to build. They are not a description of the current code.

- [Product Requirements](prd-cms-platform.md): features, personas, data model and rollout phases.
- [Implementation Roadmap](implementation-roadmap.md): the phased build plan and proposed project structure.
- [Development Task List](development-todo.md): tasks for each sprint, with estimates.

## Reference

- [NooblyJS Core Usage](nooblyjs-core-usage.md): service registry setup, providers, options and REST endpoints.

## Publishing Docs

The landing page lists only the docs named in `published.json`. Each entry looks like this:

```json
{ "file": "quickstart.md", "description": "Shown under the title on the landing page" }
```
