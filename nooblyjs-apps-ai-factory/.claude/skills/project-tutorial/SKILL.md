---
name: project-tutorial
description: Analyze sub-projects and generate structured learning tutorials
type: Skill
tags: [nooblyjs-ai, skills, project-tutorial]
---

# Project Tutorial Generator

This skill helps you understand your sub-projects by analyzing their code and generating interactive tutorials in a structured learning format.

## Available Sub-Projects

In this solution (`nooblyjs-apps/nooblyjs-apps-ai-factory/`): the host at its root, and the apps in `src/apps/`:

- nooblyjs-ai-host (the solution root)
- nooblyjs-ai-design (`src/apps/design`)
- nooblyjs-ai-factory (`src/apps/factory`)
- nooblyjs-ai-infrastructure (`src/apps/infrastructure`)
- nooblyjs-ai-knowledge (`src/apps/knowledge`)
- nooblyjs-ai-operations (`src/apps/operations`)
- nooblyjs-ai-product (`src/apps/product`)
- nooblyjs-ai-security (`src/apps/security`)
- nooblyjs-ai-teammate (`src/apps/teammate`)

Beside the solution, as sibling folders of `nooblyjs-apps-ai-factory/` in `nooblyjs-apps/`:

- nooblyjs-ai-desktop (`nooblyjs-apps-ai-desktop/`)
- nooblyjs-ai-harness (`nooblyjs-apps-ai-harness/`)

## How It Works

When you invoke this skill with a project name:

1. **Analyze Phase**: I explore the project structure, key files, package.json, README, and source code
2. **Learn Phase**: I create a comprehensive tutorial that explains:
   - What the project is and its purpose
   - Core concepts and architecture
   - Key components and how they interact
   - Entry points and main workflows
   - Dependencies and external integrations
3. **Summary Phase**: You get a clear recap of what you've learned

## Tutorial Format

Each tutorial follows this structure:

### Introduction
- What you're about to learn
- Why it matters
- Prerequisites or related projects

### Core Learning
- **Purpose & Overview**: What the project does
- **Architecture**: How it's organized
- **Key Components**: Main modules and their responsibilities
- **How It Works**: Data flow and workflows
- **Key Technologies**: Tools, frameworks, libraries used

### Summary
- Main takeaways
- How it connects to other projects
- Next steps for deeper learning

## Usage

```
/project-tutorial nooblyjs-ai-design
/project-tutorial nooblyjs-ai-harness
/project-tutorial all  (generates overview of all projects)
```

## Options

- `--detailed`: Include code examples and specific file references
- `--mermaid`: Include architecture diagrams
- `--save`: Save tutorial as a document in the project
- `--compare <project2>`: Compare two projects' architectures

---

**Tip**: You can follow up with questions about specific components, and I'll dive deeper into any area you want to understand better.
