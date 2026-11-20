# NooblyJS Cloud — Style Guide & Product Specification

Nov 19, 2026 · @Stephen Booysen

## 1. Overview and how to use this

NooblyJS Cloud is a self-service hosting platform, like Heroku or Render, that runs on NooblyJS engineering. A customer signs up, connects GitHub, launches a service from a repo, and then watches each service's resource use and logs.

**For Claude Code:** export this doc as Markdown and save it in the repo as `docs/SPEC.md`. Add one line to `CLAUDE.md`: "Follow docs/SPEC.md for all UI and product decisions." Section 2 is the style source of truth. Sections 5 to 8 say what to build and in what order. The Design canvas *NooblyJS Cloud* holds the reference mock-ups for the five screens.

### Scope for v1

| In scope | Out of scope for v1 |
| --- | --- |
| Email and GitHub sign-up, workspaces, projects | SSO and SAML, fine-grained roles |
| 9 service types (section 6) | Custom domains UI beyond one per service |
| GitHub repo connect, auto-deploy on push | GitLab and Bitbucket |
| Build from Node, Python, Go or a Dockerfile | Buildpack marketplace |
| Instance types, instance count | Autoscaling rules editor |
| CPU, memory, requests, bandwidth metrics | Alerting and paging |
| Live and historical logs, filter by level | Log drains to third parties |
| Environment variables and groups | Preview environments per pull request |

### Product principles

- **Warm, not a console.** The NooblyJS theme is friendly and human. Never fall back to a dark infrastructure-console look, except inside the log viewer.
- **Numbers always have units and limits.** Show "0.84 vCPU · 42%" and "Limit 2 vCPU", never a bare number.
- **Say what happens.** Buttons name the exact action: *Deploy web service*, *Manual deploy*, *Restart*.

## 2. Style guide: design tokens

The app uses the **NooblyJS Bootstrap 5 theme** unchanged. Load Bootstrap 5.3.3, Bootstrap Icons 1.11.3, then `nooblyjs-bootstrap.css` (from the NooblyJS design system, `dist/nooblyjs-bootstrap.css`). Write plain Bootstrap markup and the `.nj-` components. Never hard-code a hex value in a component: use the `--nj-` variables below.

### Colour (light mode)

| Token | Hex | Use |
| --- | --- | --- |
| `--nj-bg` | #F5F1EE | Page ground (warm grey, never pure white) |
| `--nj-surface` | #FFFFFF | Cards, inputs, tables |
| `--nj-surface-sunken` | #FBF8F6 | Sidebar, top bar, instance tiles |
| `--nj-hover` | #F0E9E4 | Hover fill, meter track |
| `--nj-border` | #E6DED8 | 1 px card and table borders |
| `--nj-border-strong` | #DCD2CB | Inputs, secondary buttons, dashed dividers |
| `--nj-ink` | #241C1A | Body text, active nav, log viewer ground |
| `--nj-ink-2` | #4A3F3A | Secondary text |
| `--nj-muted` | #6B605A | Labels, captions, meta |
| `--nj-on-ink` | #FFF8F2 | Text on ink |
| `--nj-on-ink-muted` | #CDBFB7 | Quiet text on ink |
| `--nj-accent` | #C2471F | Persimmon: the one action colour (primary buttons, CPU meters, selected option border) |
| `--nj-accent-hover` | #A63F1C | Primary hover, link colour |
| `--nj-accent-soft` / text | #FCE3D6 / #8A3415 | Icon circles, "Beta", "New" |
| `--nj-accent-tint` | #FFF4EE | Selected option card fill |
| `--nj-teal` | #2B7F86 | "Working / good": live, healthy, memory meters, switches on |
| `--nj-teal-soft` / text | #DDEFEC / #1C5A5F | Live and Healthy pills, success banners |
| `--nj-warning-soft` / text | #FBEFD2 / #6E4A0E | Deploying, building, slow |
| `--nj-danger-soft` / text | #F8DADD / #7D1A26 | Failed, error |
| `--nj-neutral-soft` / text | #ECE6E1 / #5E534D | Suspended, succeeded (cron), idle |

Dark mode: set `data-bs-theme="dark"` on `<html>`. Every token has a dark value in the theme file. Ship light mode first; the theme gives dark mode for free.

### Metric colours (fixed meanings)

| Metric | Colour |
| --- | --- |
| CPU | `--nj-accent` #C2471F |
| Memory | `--nj-teal` #2B7F86 |
| Requests | `--nj-ink` #241C1A |
| Bandwidth | `--nj-accent-hover` #A63F1C line, `--nj-accent-light` #F2A27E fill |

Chart area fills use the line colour at 10 to 22% opacity. Series in one chart must differ in lightness, not only hue.

### Typography

| Role | Font | Size / weight |
| --- | --- | --- |
| Page title (h1) | Bricolage Grotesque | 44 px / 800, tracking -0.03em |
| Marketing hero | Bricolage Grotesque | 60 px / 800, tracking -0.035em |
| Section title (h2) | Bricolage Grotesque | 26 to 32 px / 700–800 |
| Card title | Bricolage Grotesque | 20 to 22 px / 700 |
| Big numbers (stats) | Bricolage Grotesque | 32 to 38 px / 800, tabular figures |
| Body | Figtree | 16 px / 400, line-height 1.55 |
| Table cells | Figtree | 15 px, tabular figures |
| Labels | Figtree | 14.5 px / 600 |
| Captions, meta | Figtree | 12.5 to 13 px / 600 |
| Eyebrow | Figtree | 13 px / 700, uppercase, tracking 0.06em, muted |
| IDs, commits, URLs, logs, commands | JetBrains Mono | 13 to 14.5 px |

All money, sizes, percentages and counts use `font-variant-numeric: tabular-nums` (`.nj-num`).

### Radius

| Element | Radius |
| --- | --- |
| Chips, log level badges | 8 px (6 px for log badges) |
| Buttons, inputs, nav links | 12 px (10 px for small) |
| Option cards, repo rows, alerts | 14 px |
| Stat tiles, instance tiles | 18 px |
| Cards, fieldsets, log viewer | 20 px |
| Hero card, sign-up card, modals | 24 px |
| Pills, meters, avatars, switches | fully round |

### Spacing and elevation

- Spacing steps: 4, 8, 12, 16, 20, 24, 32, 48, 64 px. Sections are 32 px apart, cards 18 px apart, card padding 22 to 26 px.
- Separate with 1 px borders. Use shadows only for motion and floating layers: hover lift `0 10px 24px -14px rgba(60,30,20,.35)` with `translateY(-2px)`; menus and modals `0 24px 48px -20px rgba(60,30,20,.40)`.
- Focus: 2 px persimmon outline, offset 2 px, or the focus ring `0 0 0 3px rgba(194,71,31,.28)` on inputs.
- Motion: 150 ms, `cubic-bezier(0.2, 0.7, 0.2, 1)`. Respect `prefers-reduced-motion`.

### Never

Gradients, emoji, cards with a coloured left border, pure white page grounds, Inter, Roboto or Arial, saturated fills behind text.
