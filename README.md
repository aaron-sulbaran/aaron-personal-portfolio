# aaronsulbaran.com

This is my personal site. I'm Aaron Sulbaran, a fourth-year ECE student at UT Austin headed into product management. I treat the site as a living product: I'm the only user who matters at first, and I ship new things to it in public as fast as I can think of them. If you're here from LinkedIn, the short version is that it's a hero made of cards you can spin, a few honest sections, and a lot of small details I couldn't leave alone.

Production currently serves a holding page ("Pardon the dust.") while I finish the rebuild. The full site is what `pnpm dev` shows, so everything below is what you get when you run it.

## What's on the page

The site is one scrolling document at `/`; the old Work and About pages are now sections of it, and their URLs send you to the right spot.

- **The Coil.** The hero is a WebGL helix of photo and work cards riding a diagonal endless conveyor, over a slow shader field, with my name sitting behind it. On a laptop you hover and wheel to spin it; on a phone you drag. Vertical page scroll is never hijacked, and with reduced motion on you get a still picture of the scene instead.
- **Card modals.** Click a card and it flies into a detail view. The card that lands is the exact card that was drawn in the scene, so the flight has no seam. Photos get a gallery, work cards get the story and the links.
- **The book.** Under the hero is a two-column text table of the same cards. It is the plain, fast, searchable way to read what the Coil shows off.
- **The soundtrack.** A band with a playback pill and a waveform that lives only inside it. The tracks right now are placeholders while I sort out music.
- **Who I am.** A short section in my own words, with inline links that open definitions, tips and photo pops instead of sending you away.
- **Proof of work.** A numbers strip with my GitHub contribution skyline, my commits drawn as a skyline.
- **Connect.** The section where I ask whether you want to chat, and how to book some time.
- **build.stuff.** The footer is a giant wordmark with its own shader field rising through the letters. The period is a small egg, so go poke it.

There is also a chrome of its own: the AS mark that does something if you hold it, a Menu pill, a theme toggle, and a custom cursor.

## How it got here

1. **Phase 1.** A static portfolio built in April 2026: a hero ring of fourteen photos, a work index, and detail pages. It did the job and looked like a portfolio.
2. **The tile ring.** In June I redesigned the home around a ring of glass tiles with shared-element flights into modals, a scroll collapse into a deck, and a separate mobile version. It was pretty, and it was also a lot of code for two versions of one idea. I retired it.
3. **The Coil.** In late September I rebuilt the hero from scratch as one object with two drivers: one scene, a fine pointer or a coarse one, no separate mobile component. Everything since (the book, the flight, the soundtrack, the numbers strip, the footer) has been built on top of it.

An earlier plan had a dual-path landing with a 3D globe. I dropped it, and I'm not bringing it back.

## How I build it

Labs before specs. For anything about motion or look, I build a small lab page with sliders, tune it by hand until it feels right, and press "copy values". Those numbers become the spec and then the code. Hero values live in one constants file, never retuned by eye in a component. The labs themselves live on a local branch and never merge; their results do.

I also write short feature specs in `docs/` and ship one slice per pull request. If you want the reasoning behind the hero, these are public:

- [`docs/design-decisions-2026-09-28.md`](docs/design-decisions-2026-09-28.md): what the Coil is, and the rulings I made by hand.
- [`docs/coil-build-scaffold.md`](docs/coil-build-scaffold.md): architecture, module layout and contracts.
- [`docs/coil-input-model.md`](docs/coil-input-model.md): who owns the wheel, and how the flight hands off.
- [`docs/coil-scene-modules.md`](docs/coil-scene-modules.md) and [`docs/adr/0001-coil-scene-split.md`](docs/adr/0001-coil-scene-split.md): how the scene is split, and why.
- [`docs/lab-log-2026-10-05.md`](docs/lab-log-2026-10-05.md): what each lab asked and what I picked.

## Stack

- Next.js 16 (App Router, Turbopack) and React 19
- TypeScript, strict
- Tailwind CSS 3.4 with CSS custom properties for every color, light and dark
- Framer Motion for modals and DOM entrances; GSAP for scroll; vanilla three.js for the Coil and the shader fields (no React Three Fiber, one dynamic chunk)
- Profa for display type and Inter for body
- vitest for unit tests, Playwright for end to end, against local production builds
- Vercel for hosting, with pnpm as the package manager

The rule that keeps it sane: GSAP owns scroll, three never writes it, and Framer never touches the canvas.

## Run it

```bash
pnpm install
pnpm dev                       # the full site at http://localhost:3000
```

```bash
NEXT_PUBLIC_SITE_MODE=full pnpm build && pnpm start -p 3100   # a full production build
pnpm build                     # what production serves today: the holding page
```

```bash
pnpm test                      # vitest
pnpm test:e2e                  # Playwright (builds what it needs)
pnpm tsc --noEmit              # type check
pnpm lint                      # eslint
```

`pnpm dev` and `pnpm build` share a `.next` folder, so don't run both in one checkout at the same time.

## Say hi

If something here made you curious, the Connect section of the site is the way to reach me.
