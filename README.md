# aaronsulbaran.com

Personal portfolio for Aaron Sulbaran, a third-year ECE student at UT Austin pursuing product management. Built with Next.js 14 App Router, Tailwind CSS, and Framer Motion. The site is fully static with no backend: a home page anchored by an animated glass-tile ring with shared-element flight transitions into modal detail views, an `/about` page, and a `/work` index with detail pages per project. Fonts are Instrument Serif and Inter via `next/font/google`. Deploys on Vercel at [aaronsulbaran.com](https://aaronsulbaran.com).

## Development

```bash
pnpm dev      # start the local dev server at http://localhost:3000
pnpm build    # production build
pnpm lint     # lint the codebase
```

## Deploy

The site deploys automatically on Vercel. To deploy manually after running `vercel link`:

```bash
vercel deploy --prod --yes
```

## Docs

- [`docs/aaronsulbaran_phase1_prd.md`](docs/aaronsulbaran_phase1_prd.md): scope, features, user flows, acceptance criteria, build order.
- [`docs/design.md`](docs/design.md): visual hierarchy, typography, color, motion, photo treatment, layout patterns.
- [`AGENTS.md`](AGENTS.md): repo-wide conventions, architecture, and current build state for AI agents.
