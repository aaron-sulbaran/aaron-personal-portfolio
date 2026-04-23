# AGENTS.md

Persistent instructions for every AI agent (Claude Code, Cursor, or any other) working in this repo. Read this first, every time. Keep it scannable.

---

## 1. Project overview

aaronsulbaran.com is the personal website for Aaron Sulbaran, a third-year ECE student at UT Austin pursuing product management. Phase 1 is a single-page, scroll-driven Next.js site that replaces a broken loading page so the URL is ready to link from LinkedIn. The audience is recruiters and peers arriving from LinkedIn, and the site needs to feel intentional, first-person, and distinctive in under 60 seconds. Phase 2 (dual-path landing with a 3D globe) is out of scope here and lives only in the PRD appendix.

---

## 2. Source of truth docs

Every agent must read both of these in full before making any changes:

- [`docs/aaronsulbaran_phase1_prd.md`](docs/aaronsulbaran_phase1_prd.md) — scope, features, user flows, acceptance criteria, build order.
- [`docs/design.md`](docs/design.md) — visual hierarchy, typography, color, motion, photo treatment, layout patterns.

**Conflict resolution:**

- PRD wins on scope and feature behavior.
- design.md wins on visual and motion details.

Do not paraphrase or summarize these docs in code comments or new files. Link to them.

---

## 3. Skill consultation protocol

Reproduced verbatim from design.md's "Related Skills to Consult" section.

Aaron has the following design skills installed. **Do not blindly invoke all of them** — that wastes tokens and adds noise. Instead, use the following protocol:

1. Before invoking any skill, check whether this project's current task meaningfully benefits from it (see the relevance notes below).
2. If it seems relevant, ask Aaron: "This task seems like a fit for [skill name]. Want me to consult it before proceeding?"
3. Only invoke the skill after Aaron confirms.
4. Never chain-invoke multiple skills without checking in between.

### Skills ranked by likely relevance for Phase 1

**High relevance (likely worth invoking with approval)**

- `frontend-design:frontend-design` — Distinctive, production-grade frontend interfaces. This is the anchor skill. Consider invoking at the start of the build to set visual direction, especially for the hero and photo ring treatment.
- `ui-polish:refactoring-ui` — Tailwind + shadcn professional UI design principles. Relevant throughout the build since the stack is Next.js + Tailwind. Good resource for spacing, hierarchy, and visual weight decisions.
- `/plan-design-review` — Designer's-eye plan review. Consider invoking once, before the build starts, to pressure-test the PRD from a design perspective and catch issues early.
- `/design-review` — Live visual QA with iterative fixes. Consider invoking after the site is running locally but before deploy. Expect it to commit fixes iteratively.

**Situational relevance (invoke only if a specific need arises)**

- `ui-polish:review` — Analyze UI components via Refactoring UI principles. Useful if a specific component (hero, a section block) looks off after first pass and needs a targeted critique.
- `ui-polish:refactor` — Refactor a UI component applying Refactoring UI. Useful as a follow-up to `ui-polish:review` if the recommendations are actionable.
- `ui-ux-pro-max:ui-ux-pro-max` — 50+ styles, 161 palettes, 57 font pairings. Only useful if Aaron wants to explore alternatives to the locked-in deep sea blue palette or the serif + Inter pairing. The design decisions are already made, so default to skipping this unless Aaron explicitly asks to reconsider.
- `chrome-devtools-mcp:a11y-debugging` — Accessibility debugging via web.dev guidelines. Worth invoking during the accessibility pass (step 12 in the PRD build order).
- `next-devtools` — Next.js rendering and routing diagnosis. Invoke only if rendering issues appear (hydration mismatches, slow builds, routing weirdness).

**Unlikely to be relevant for Phase 1 (do not invoke unless Aaron explicitly requests)**

- `figma:*` (all Figma skills) — Phase 1 goes straight from PRD to code without a Figma design step. Skip unless Aaron decides to do a Figma round.
- `claude_ai_Canva` — Not a fit for a personal site built in Next.js.
- `/design-shotgun` — Generates multiple variants for comparison. The design direction is locked in (deep sea blue, serif marquee, glass photo frames, scroll-driven ring). Skip unless Aaron wants to explore alternatives before committing.
- `/design-html` — Produces HTML/CSS from mockups. There are no mockups to convert.
- `/design-consultation` — Builds a design system from scratch. The design system is already specified in this file and the PRD.

### Protocol when skill invocation would be excessive

If a task genuinely fits three or more skills, do not invoke all three. Pick the single best fit and ask Aaron if he wants to consult more after seeing the result. Stacking skill calls burns tokens and produces conflicting recommendations.

### Defaults for this repo

- **Default to consulting `frontend-design:frontend-design`** at the start of any design work. Still ask first.
- **Default to skipping Figma and Canva skills** unless Aaron explicitly asks for them.

---

## 4. Hard rules (non-negotiable)

- **No hardcoded hex values in component files.** All colors go through CSS custom properties in `app/globals.css`, mapped to Tailwind tokens in `tailwind.config.ts`. Components reference tokens (`bg-background`, `text-accent`), never raw hex.
- **All site copy lives in `lib/content.ts`.** Components import from there and never embed strings.
- **No em dashes in any copy, ever.** Aaron's preference. Use commas, semicolons, or separate sentences. This applies to body copy, comments, and docs.
- **First person voice throughout all copy.** No third-person "Aaron is..." framing.
- **No resume link, no contact form, no placeholder projects section.** Those belong to Phase 2.
- **No navigation bar.** This is a single-page site, scroll-only.
- **`prefers-reduced-motion` must be respected globally.** Ring animation disabled, photos static, continuous rotation off.

---

## 5. Tech stack

- **Framework:** Next.js 14+ (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Animation:** Framer Motion
- **Fonts:** Instrument Serif + Inter, loaded via `next/font/google`
- **Icons:** Lucide React
- **Deployment:** Vercel
- **Domain:** aaronsulbaran.com (already owned, needs to be pointed at Vercel)

No backend, no database, no auth, no state management library. React hooks are sufficient.

---

## 6. File structure

```
/app
  layout.tsx
  page.tsx
  globals.css
/components
  ThemeToggle.tsx
  Hero.tsx
  PhotoRing.tsx
  ScrollIndicator.tsx
  WhoIAm.tsx
  UpToNow.tsx
  Connect.tsx
  Footer.tsx
/lib
  content.ts
  theme.ts
/public
  /photos
    photo-01.jpg
    photo-02.jpg
    ...
```

Keep component files under 200 lines where possible. Split large components before they balloon.

---

## 7. When in doubt

Three questions to ask before any design decision (from design.md):

1. **Does this feel like Aaron?** First person, building in public, living document. If it feels corporate or templated, reconsider.
2. **Is this earning its space?** If an element doesn't clearly serve the visitor's 60-second first impression, cut it.
3. **Would I be proud to share this on LinkedIn?** This is Aaron's actual test. The site should pass it.
