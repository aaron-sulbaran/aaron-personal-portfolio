# aaronsulbaran.com, how I built it.

[aaronsulbaran.com](https://aaronsulbaran.com) is my personal site. It changes from time to time but right now it's a hero made of cards you can spin, a few honest sections about me, and a lot of small features and details I loved building. This repo is the how I built it, what I changed my mind about, and why.

## Why I built this

I'm a fourth-year ECE student at UT Austin, headed into product management. Product work is mostly invisible from the outside: the options you weighed, the feature you cut, and the trade-off decisions all get flattened by a resume.

So I made my own site with the vision of it becoming its own product. Its audience is someone who followed a link and has about a minute, and it has two jobs for them. First, feel something distinctive and anti-slop. Second, get what they need (facts about me) fast, without needing to play with anything. Almost every decision below is me trying to serve both, never letting the user leave my mind.

The repo is public and I plan to keep changing it over time. Features arrive as small parts or PRs, oftentimes of a bigger vision, with a reason attached.

## Product decisions and iterations

Each row is a real change with the commits that made it. Links open the commit in this repo.

| What I changed | Why | See it |
|---|---|---|
| **A ring of photos became the Coil.** April was a ring of fourteen photos. June was glass tiles, a scroll collapse and a separate mobile version. September was one WebGL helix of photo and work cards, with a touch driver and a pointer driver instead of two products. | The ring was pretty and expensive: two code paths for one idea. A single object that behaves differently by input is cheaper to keep honest, and it is the first thing a visitor remembers. | [the decision list](../../commit/6535ebc), [my sign-off on the hero](../../commit/2a21fe8), [the ring retires](../../commit/e1b8096), [the Coil becomes the home](../../commit/866a190) |
| **The book went under the hero.** A two-column text table of the same cards. | The Coil is the memorable part, not the fast part. Someone who won't spin anything still gets every role and project on one screen. | [the book](../../commit/36d2fc9), [hero lab picks](../../commit/523bed8) |
| **Page scroll is never hijacked.** I rewrote the wheel rule several times. | First the Coil took the wheel anywhere inside its silhouette, gaps included, which trapped people scrolling past. Now ownership is decided once per gesture: the Coil gets the wheel only over a card or the gap between two, after a real pointer move, and page scroll never turns it. | [wheel ownership as a pure rule](../../commit/7a34d1f), [capture only where the cursor says](../../commit/d870f46), [page scroll stops feeding it](../../commit/653443d), [the input model](docs/coil-input-model.md) |
| **A fallback is a feature.** No WebGL 2, reduced motion, or a failed chunk shows a real picture of the scene. | Plenty of visitors can't run the hero. They should land on something good, not a spinner. The picture is rendered from the scene itself, and a quiet notice says why in one sentence per cause. | [the probe](../../commit/ec08531), [the hero stills](../../commit/b8a2f2b), [the notice](../../commit/4233087) |
| **The soundtrack wave follows the reader.** | The band did exactly what I asked and nothing more: the wave sat in one spot, so you only saw it if you parked there. The new brief was one ask, then the wave follows you down the page and the pill lands where the music lives, all without costing readability. It went from a horizon strip to a single line drawn as you scroll. | [the spec and decision](../../commit/cb894e9), [the horizon strip](../../commit/bdfa118), [the pill condenses out of the band](../../commit/86242a4), [the scroll-drawn line](../../commit/749a8fa) |
| **Proof of work grew a toolkit.** The strip started as my GitHub skyline. It now flips to Claude and Codex token days, and shows my agent setup with the most used tools first. I took the LinkedIn figure off because it didn't earn its space. | I build with agents, so I'd rather show that plainly than hint at it. The data is names and counts only, never prompts or paths. | [the token switch](../../commit/fa9569e), [the one wave across the strip](../../commit/f669f22), [the toolkit band](../../commit/8ff6c6c), [counting calls from a public list](../../commit/b12fd08), [LinkedIn comes off](../../commit/1b7d5dc) |
| **A thirty-second version.** The Minimum Viable Portfolio is a short page for the busiest readers, with the same cards opening the same modals, no WebGL, and a quiet first-visit invite. What's Next? sits at its foot. | The Coil is the front door, but not everyone has time to use it. A product with one path loses the person in a hurry. | [the page](https://aaronsulbaran.com/quick) |
| **The Talos card follows the theme.** The coin switches with light and dark, the radar sting is ported from its brand kit as inline SVG, and a Discord screenshot shows it at work. | A card for something I run should look like that product in either theme. Inline SVG stays sharp at any size and adds no image weight. | [the card](https://aaronsulbaran.com) |

## The design calls

- **One accent, plus one exception.** Sea blue, soft sea blue in dark mode. The only second hue is a burnt orange, about a fifth of the shader field, and  both have personal meanings while still complementing each other. [Where I landed on it](../../commit/523bed8).
- **Cards recede by brightness and curvature, never blur.** The Coil's cards are opaque panes. Real blur is saved for modals over a frozen scene.
- **Type has a job each.** Profa Black upright for display, Profa Bold for labels and controls, Inter for reading. Sentence case, no tracked caps. [Display face](../../commit/32554ad), [label face](../../commit/1570e1e), [spec](docs/label-face-spec.md).
- **Slow, low amplitude motion, and a calm way out.** I though about accessibility and designed for reduced motion users who get still pictures, all the text, and the most important info persists.
- **First person everywhere,** including image alt text. One sweep checks every string for broken links, missing files and third-person alts. [The sweep](../../commit/1aa13d1).
- **No stock imagery.** Photos are mine, or things I chose.
- **The loader tells the truth.** It is a weighted tally of real assets, it only appears when loading is actually slow, and it never flashes. [Loader](../../commit/8db6e2f).
- **Small things on purpose.** Hold the AS mark to see a cel-drawn strike. The period in the footer wordmark is an egg. [The mark](../../commit/69b829e), [the footer](../../commit/f97e5df).

The decision log behind the hero is in [`docs/design-decisions-2026-09-28.md`](docs/design-decisions-2026-09-28.md).

## Stack, architecture and the technical calls

Next.js 16 (App Router) and React 19, TypeScript in strict mode, Tailwind 3.4 on CSS custom properties for every color, Framer Motion for modals and DOM entrances, GSAP for scroll, and vanilla three.js for the Coil (no React Three Fiber). vitest for unit tests and Playwright for end to end, against local production builds. pnpm, deployed on Vercel.

The calls that shaped it:

- **Three loads only when it can draw.** The scene is one dynamic chunk, requested after a real WebGL 2 probe. Reduced motion, no WebGL and a failed probe never fetch it.
- **One owner per job.** GSAP owns scroll, three never writes it, and Framer never touches the canvas. No two libraries drive one transform.
- **The flown card is the rendered card.** Click a card and the scene draws that exact card into an overlay for the flight, so there is no seam to hide. Pixel diffs hold it at each handoff. [The flight](../../commit/15896a6), [the input model](docs/coil-input-model.md).
- **A 2,500-line scene became a composition root and modules,** with no behavior change, so a new per-frame concern is a module and a step in one ordered table. [ADR 0001](docs/adr/0001-coil-scene-split.md), [the module map](docs/coil-scene-modules.md).
- **Colors are read once per theme.** WebGL never reads CSS variables at frame time.
- **Logic is pure and tested.** Geometry, motion, wheel ownership, the reveal and the metrics maths live in small modules beside their tests, with end to end specs for the behavior you can only see.
- **Copy is data.** Every string lives in a typed content layer, and tests scan it.

## How I build it

I build this with Claude agents, and I make my own changes by hand and review the code throughout. Most commits carry a Claude co-author trailer because I have autonomous review agents anytime I write code (whether agentic or by hand) and I read the diffs before they merge. The toolkit band on the site is the live count of that setup.

Three habits keep it from turning into AI-generated mush:

- **Labs before specs.** For anything about motion or look, I build a throwaway lab page with sliders and tune it by hand until it feels right. The numbers I pick become the spec, then the code.
- **One pull request per slice.** Small commits, never squashed, so the history reads as the work happened.
- **A second reader.** Another model reviews each slice, and the review is a gate, not a formality.

The plans, lab notes and a few private pages live in a separate private repo, so they aren't here.

## About this repo

This repo is generated from my private working repo by a script that keeps the original commits, dates and messages, and filters out the parts that aren't for the public: planning docs, personal photos and the soundtrack's audio. Commit hashes differ from the private repo, and a fresh clone builds but won't play music.

```bash
pnpm install
pnpm dev                       # the full site at http://localhost:3000
pnpm test                      # vitest
pnpm build && pnpm start -p 3100
```

If something here made you curious, the Connect section of the site is the way to reach me.
