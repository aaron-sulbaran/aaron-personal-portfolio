# Logo credits for the work cards

Retrieved 2026-09-29 at Aaron's request. Nothing here is wired into a component yet. The five original placeholders (`anthropic.svg`, `capital-one.svg`, `hackathon.svg`, `ieee.svg`, `site.svg`) are untouched and still carry `aria-label="Placeholder logo: ..."`.

Trademark note: every third-party mark below belongs to its owner. It appears on the site only to say where I worked, studied, or built, never to imply endorsement. Keep original colors and proportions, and do not alter the marks.

## Files

| Brand | File | Source | Terms as stated at the source | "Worked at / affiliated with" use |
|---|---|---|---|---|
| Anthropic | `anthropic-wordmark.svg` (Slate `#141413`, for light backgrounds), `anthropic-wordmark-dark.svg` (Ivory `#FAF9F5`, for dark backgrounds) | Anthropic press kit, "Anthropic logos / 1 Anthropic logo / SVG" | No terms in the download or on the Newsroom page. See notes. | Not stated. Low risk as a factual mention; confirm with `press@anthropic.com` if it matters. |
| Anthropic | `anthropic-symbol.svg` (Slate), `anthropic-symbol-dark.svg` (Ivory) | Same press kit, "2 Anthropic symbol / SVG" | Same | Same |
| Claude | `claude-mark.svg` (the Spark, Clay `#D97757`, one color) | Same press kit, "Claude logos / 3 Claude Spark / SVG" (Clay is the only SVG offered) | Same | Same |
| Claude | `claude-wordmark.svg` (Spark plus "Claude", for light), `claude-wordmark-dark.svg` (Ivory type, for dark) | Same press kit, "Claude logos / 1 Claude logo / SVG" (Slate and Ivory variants) | Same | Same |
| min/Max | `minmax-mark.svg` (ink `#0B1B34`), `minmax-mark-dark.svg` (white) | Aaron's own product. `min-max-web` repo, `src/lib/brand/geometry.ts` (`markPaths`, `markStroke`, `markViewBox`) rendered as `src/components/brand/mark.tsx` does. Geometry last changed in commit `9b1cf6f`; repo HEAD when exported was `70c93cf`. | Own work | Yes |
| min/Max | `minmax-lockup.svg` (ink), `minmax-lockup-dark.svg` (white) | Same, `wordmark` in `geometry.ts` rendered as `src/components/brand/lockup.tsx` does. Colors from `src/lib/brand/colors.ts`. "in" and "ax" are Nunito Medium (`@fontsource/nunito` 5.3.0, SIL OFL 1.1) outlined to paths at the source's own font size, x, and baseline, so no font is needed. Advance widths match the source's `textLength` exactly. | Own work; Nunito is OFL 1.1, which allows embedding outlines | Yes |

Retrieved from: `https://www.anthropic.com/press-kit` (redirects to `https://www-cdn.anthropic.com/ae59ca4ca194dac9c9dc3bc78c5829468cb0e8af.zip`, 26,465,941 bytes, sha256 `c68ac92df86c825f95177e24016fcc9a8863a3fd4ca344fe6f0700b2c1e07151`). The link is the "Download press kit" button under "Media assets" on `https://www.anthropic.com/news`.

Anthropic files are byte-identical to the kit, renamed only. The two Claude wordmark files contain an inline `<style>` block with class fills (no external references, no scripts, no rasters). If either is ever inlined into the page instead of loaded through `<img>`, its `id="Layer_1"` and `.st0`/`.st1` class names could collide with other inlined SVGs.

## Not obtained

| Brand | Status | Why | What is needed |
|---|---|---|---|
| Capital One | No file | Capital One publishes no public logo or brand page. The newsroom (`capitalone.com/about/newsroom/`) and its media contacts page say inquiries are for working media only. The official asset portal, `https://brandfolder.com/capital-one`, is a private Brandfolder behind a sign-in ("Welcome to the Capital One private Brandfolder"). Its own footer says nothing about public use. I did not use logo aggregators or the site's header artwork. | Aaron requests access through the recruiter or manager from his role, or asks the Capital One media relations team. Until then the placeholder stays. Their logo is a registered trademark, so get written confirmation of "worked at" use if it matters. |
| IEEE | No file | The official source is `https://brand-experience.ieee.org/guidelines/master-brand-and-logos/` (the old `brand.ieee.org` address). Files are free to fetch, but every download is under the "IEEE Master Brand and Brand Identity Toolkit Agreement" (`https://brand-experience.ieee.org/templates-tools-resources/toolkit-agreement/`). That agreement grants use "only ... for activities that are officially sanctioned or sponsored by IEEE", limits distribution to "IEEE volunteers who are involved in an official capacity in IEEE activities and IEEE staff", and requires the user to represent that they are such a volunteer or staff. This repo is public, and accepting the agreement is a statement only Aaron can make. I did not download or accept it on his behalf. | Aaron's call. If he holds an official IEEE UT officer role and wants the horizontal Master Brand in the repo, he should download it himself. Direct links (PNG, blue/white/black): `.../download/ieee-mb-blue-png-2/?wpdmdl=4855`, `.../ieee-mb-white-png/?wpdmdl=4845`, `.../ieee-mb-black-png/?wpdmdl=4847`; vector PDFs: `.../ieee-mb-blue-pdf/?wpdmdl=4866` and siblings. The page offers no SVG. The safer option for a public portfolio is a plain text "IEEE UT Austin" set in the site's own type. The student branch is `https://ieee.ece.utexas.edu/`; I did not fetch or reproduce its mark. |
| Talos | No file | Nothing has been adopted. The 2026-09-24 helmet and ring avatars were never chosen. A 2026-09-29 brand-kit round (`~/Personal Projects/talos/brand/`, four concept lanes) is waiting on Aaron's pick. I did not copy a candidate. | Aaron picks a lane, then export from that lane's `mark.svg` and `lockup.svg`. |
| Hackathon builds | None needed | No external brand. | Keep the placeholder or design a neutral glyph later. |
| This site | Already exists | The site's own mark is in `public/brand/` (`as-mark-ink.svg`, `as-mark-paper.svg`, `as-mark-on-dark.svg`, `as-mark-on-paper.svg`, `as-bolt-*.svg`, favicon tile). | Nothing to add. |

## Checks run

For every SVG added: no `<script`, no `xlink:href`, no `<image`, no `href=`, no `onload`, no external URLs other than the `xmlns` namespace. Rendered with resvg to confirm each draws correctly.
