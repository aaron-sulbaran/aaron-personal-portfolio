# Codebase sweep before the Coil rebuild (2026-09-29)

Read-only audits of the tile-ring codebase at `main @ f49fb61`, the day before the Coil rebuild replaced it. They were written as scaffold inputs by Explore and Opus agents and lived in the gitignored `docs/research/` folder; this copy is tracked so the record outlives local state. A sixth note, the vault recon, stays private. Nothing here describes the current code. Read it to learn what the ring did, which couplings the rebuild had to cut, and which decisions the labs settled.

| File | What it holds |
|---|---|
| `components-audit.md` | Every component at the time, with line counts and importers. The headline: TileRing's controller logic (readiness, locks, modals, explored, focus, deep reload, flight orchestration, the device fork) with line ranges, and the hidden DOM couplings (`[data-state]`, `#hero-pin`, `#work`, `[data-tile-slot]`) that would break silently when the ring went. |
| `styles-docs-git-audit.md` | The token inventory in `app/globals.css`, Tailwind config, the docs that existed and how far each had drifted from the code (including the AGENTS.md drift lists), and the git state. |
| `app-lib-upgrade-audit.md` | `app/` and `lib/` inventory, the Next 14 to 16 and React 18 to 19 upgrade touch list from Context7, and config at the time. |
| `hero-lab-2-notes.md` | The second hero lab's presets, measurements and the builder's defaults before Aaron's picks. |
| `design-review-lab2.md` | The design review of hero lab 2 at Aaron's picks: the four numeric fixes before the port, the orange share measurement, the book's phone breakpoint. |

What came of it: `docs/design-decisions-2026-09-28.md` (the decisions), `docs/coil-build-scaffold.md` (the architecture these audits fed), `docs/coil-build-log-2026-09-29.md` (the PR ledger), and `AGENTS_ARCHIVE.md` (gitignored) for the ring era's Layer 2 with its load-bearing invariants.

Retired with the ring, for the record: the `collapseRef` flight contract, the `preserve-3d` wrapper chain, the stacked-pile `translateZ` stagger, arming the ScrollTrigger at `scrollReady` rather than `ready`, the `[data-state]` readiness query, and the no-`backdrop-filter`-on-tiles rule. Their successors are in the live AGENTS.md invariants and `docs/coil-input-model.md`.
