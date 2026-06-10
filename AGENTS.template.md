# <!-- Project Name -->

<!-- One-paragraph narrative: what this project is, who it's for, what makes it distinctive. -->

## Live URLs

- Production: <!-- https://example.com -->
- Preview / staging: <!-- https://preview.example.com -->
- Hosting platform / project ID: <!-- e.g., Vercel project: my-project -->
- Owner: <!-- name + contact -->
- Deadline / launch target: <!-- if any -->

## Source-of-truth docs

- <!-- [`docs/PRD.md`](docs/PRD.md): scope, features, acceptance criteria. -->
- <!-- [`docs/design.md`](docs/design.md): visual hierarchy, tokens, motion. -->

## Authority order

AGENTS.md is authoritative for repo-wide conventions and stable architecture. Sibling appendix docs are authoritative for current-increment scope only. Where they overlap, AGENTS.md wins.

## Living document protocol

This document is a living artifact. Agents working in this context follow these rules:

**Two layers, two update rules.**

Layer 1 is manually curated and closely maintained with a human-in-the-loop. However, at the start of a project from scratch or at initial creation of an AGENTS.md file in an existing codebase, an AI recommendation of what to include is acceptable. Stable conventions, scope guardrails, communication preferences, MCP rules. Agents read but do not edit. Layer 1 changes only by direct user instruction.

Layer 2 is agent-maintained. Build state, architecture diagrams, environment, in-flight work, known issues, what's next. Agents update via surgical edits at session end.

**Session-end requirement.**

Before declaring a session complete that shipped meaningful work, the agent must:

1. Re-read this document end to end.
2. Check observed reality against documented state. Files added, dependencies installed, environment variables introduced, behaviors changed.
3. Propose surgical edits to Layer 2 sections only. Use the existing format and emoji conventions.
4. Update the date stamp on the "Current build state" header to today's date if that section was modified.
5. Show the user the diff as a unified diff in a fenced ```diff block.
6. Apply only after explicit user confirmation.

A session that did research, planning, or no shipped work does not update build state.

**Drift detection is eager, not lazy.**

If at any point during the session the agent observes that documented state contradicts code reality (a feature flagged "shipped" appears broken, a documented file does not exist, a "no rate limiting" note exists alongside Upstash imports), surface this to the user immediately. Do not silently work around documented state.

**Length budget.**

This document stays under 800 lines. If a proposed edit would exceed the budget, propose archiving older items rather than appending. Archived items move to a sibling file (e.g., AGENTS_ARCHIVE.md) with the date archived.

**Date stamps.**

Only the "Current build state" header carries a (YYYY-MM-DD) stamp. Other Layer 2 sections (Architecture, Environment, What's next) are not stamped. The source of "today's date" is the date in the agent's environment context block. Update the stamp to today when modifying the "Current build state" section.

**Format conventions.**

Match existing emoji and bullet style exactly. ✅ for shipped. 🔄 for in flight. ⚠️ for known issues or not yet done. New emoji conventions require Layer 1 edits, which agents do not make.

**Authority order.**

Project AGENTS.md / CLAUDE.md is authoritative for repo-wide conventions and stable architecture. Sibling appendix docs (e.g. NEXT_STEPS.md, current-increment specs) are authoritative for current scope only. Where they overlap on conventions, the AGENTS.md / CLAUDE.md wins.

---

# Layer 1: Stable Conventions (Manually Curated)

Read-only for agents. Edits to this layer require direct user instruction.

## Stack

| Layer | Choice |
|---|---|
| Framework | <!-- e.g., Next.js 16 (App Router) --> |
| Language | <!-- e.g., TypeScript strict --> |
| UI | <!-- e.g., Tailwind CSS 4 --> |
| Auth | <!-- e.g., NextAuth, Clerk, Supabase Auth, or N/A --> |
| AI | <!-- SDK + provider + model strings, or N/A --> |
| Storage | <!-- e.g., Supabase Postgres, Vercel Blob, or N/A --> |
| Hosting | <!-- e.g., Vercel --> |
| Package manager | <!-- pnpm / bun / npm --> |
| Rate limiting | <!-- e.g., Upstash Redis, or N/A --> |

## Locked conventions

### Design tokens
<!-- Color variables, theme block location, hex-in-JSX rules. -->

### Typography
<!-- Font families, where they're loaded, anti-patterns to avoid. -->

### Aesthetic guardrails
<!-- "No X" rules: gradients, glassmorphism, stock imagery, etc. -->

### Code conventions
<!-- Em dash rule, type strictness, server vs client boundaries, schema validation library, structured-output quirks. -->

### Scope guardrails
<!-- What NOT to build without explicit user confirmation. -->

### Rate limiting
<!-- Per-route limits, keying strategy, when to add a limit. -->

## MCP tooling rules

<!-- Project-specific MCP preferences, if any. -->

## Subagent / parallel work

<!-- When to delegate, which subagent type for what. -->

## Communication preferences

<!-- Tone, plan-first vs action-first, follow-up cadence, comment style. -->

## Common tasks

| Task | Command |
|---|---|
| Local dev | <!-- pnpm dev --> |
| Build | <!-- pnpm build --> |
| Deploy to prod | <!-- vercel deploy --prod --yes --> |
| Tail prod logs | <!-- vercel logs <url> --> |

---

# Layer 2: Build State (Agent-Maintained)

Agents update this layer at session end via the protocol above. Match existing format and emoji conventions exactly.

## Architecture

<!-- File tree of relevant directories. Mark planned files with (planned). Remove the tag when shipped. No date stamp on this header. -->

```
app/
└── ...
lib/
└── ...
```

## Current build state (YYYY-MM-DD)
<!-- This is the ONLY Layer 2 header that carries a date stamp. -->

Shipped and working:

- <!-- ✅ shipped items go here -->

In flight:

- <!-- 🔄 in-flight items go here -->

Known issues / not yet done:

- <!-- ⚠️ known issues or deferred items go here -->

## Environment

<!-- Local env var checklist with set/unset markers. Note hosting env presence. No date stamp on this header. -->

```
SECRET_NAME=...   ✓ set
```

## What's next, ranked

<!-- No date stamp on this header. -->

1. <!-- highest-leverage next step -->
