---
type: Reference
title: Project Skills
description: Custom skills for the nooblyjs-ai project to help understand and develop the codebase.
tags: [nooblyjs-ai, skills]
---

# Project Skills

Custom skills for the nooblyjs-ai project to help understand and develop the codebase.

## Available Skills

### project-tutorial
**Command**: `/project-tutorial <project-name>`

Analyzes sub-projects and generates structured learning tutorials. Perfect for understanding what each part of the system does and how it works.

**Features**:
- Automatic code analysis
- Structured learning format (intro → learning → summary)
- Architecture visualization
- Cross-project comparison
- Code examples and references

**Examples**:
```
/project-tutorial nooblyjs-ai-design
/project-tutorial nooblyjs-ai-harness --detailed
/project-tutorial all
/project-tutorial nooblyjs-ai-host --mermaid
```

See `project-tutorial.md` for full documentation.

## How to Use Skills

1. Type the skill command with required parameters
2. Claude will analyze the project and generate a tutorial
3. Follow up with questions to dive deeper into specific areas
4. Use `--save` to export the tutorial as a document

## Project Structure

This solution (`nooblyjs-apps/nooblyjs-apps-ai-factory/`) is the host, at its root, and 8 apps in `src/apps/`, with one `package.json`:

| Project (folder) | Purpose |
|---------|---------|
| **nooblyjs-ai-host** (the root) | The host process: frame, Home, lifecycle engine, Platform, chat, Teams |
| **nooblyjs-ai-product** (`src/apps/product`) | Product: screens, artefacts and drafting agents (`/product`) |
| **nooblyjs-ai-design** (`src/apps/design`) | Design: requirements, solution, functional analysis, stories (`/design`) |
| **nooblyjs-ai-factory** (`src/apps/factory`) | Software Factory: the line, the `factory` CLI and its Test section (`/factory`) |
| **nooblyjs-ai-infrastructure** (`src/apps/infrastructure`) | Environments, designs, provisioning runs, drift and cost (`/infrastructure`) |
| **nooblyjs-ai-security** (`src/apps/security`) | Security by design: threat models, scans, findings (`/security`) |
| **nooblyjs-ai-operations** (`src/apps/operations`) | Release, rollout, rollback and operate (`/operations`) |
| **nooblyjs-ai-teammate** (`src/apps/teammate`) | Digital Teammates: tasks, chat and Teams answers (`/teammates`) |
| **nooblyjs-ai-knowledge** (`src/apps/knowledge`) | Knowledge Repository: the wiki (`/wiki`) |

The agent harness (`nooblyjs-apps-ai-harness`) and the desktop app (`nooblyjs-apps-ai-desktop`) are not in this solution: they sit in `nooblyjs-apps/`, beside it. The `project-tutorial` examples below still name them; they are not in this folder.

## Tips

- Start with `nooblyjs-ai-product` to understand the overall vision
- Then explore `nooblyjs-ai-host` (the solution root) to see the main application
- Use `--compare` to understand how projects relate to each other
- Reference the `/steering` folder for design, product, and roadmap docs
