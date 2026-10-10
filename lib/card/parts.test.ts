import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { cardDims, containBox, logoBox } from "@/lib/coil/cardFace";
import { COIL } from "@/lib/coil/constants";
import { strandCardByKey, type CardKey } from "@/lib/content";
import { CardFace } from "@/components/card/CardFace";
import { CardHeader } from "@/components/card/CardHeader";
import { CardLinks } from "@/components/card/CardLinks";
import { MentorsList } from "@/components/card/MentorsList";
import { TimelineEntry } from "@/components/card/TimelineEntry";

// next/image's optimizer needs a server; a plain img is enough to read the markup.
vi.mock("next/image", () => ({ default: (props: Record<string, unknown>) => createElement("img", { src: props.src, alt: props.alt, className: props.className, style: props.style }) }));

const face = (key: CardKey) => {
  const f = strandCardByKey.get(key)?.face;
  if (!f) throw new Error(`${key} is not on the strand`);
  return renderToStaticMarkup(createElement(CardFace, { face: f }));
};
const header = (cardKey: CardKey, compact: boolean) => renderToStaticMarkup(createElement(CardHeader, { cardKey, renderMedia: true, compact }));

describe("the header tile's face", () => {
  it("puts a logo with no dark file on a plate that shows only in the dark theme, never IEEE's square or Talos's anvil", () => {
    expect(face("capital-one")).toContain('data-plate=""');
    expect(face("capital-one")).toContain("dark:block");
    expect(face("ieee")).not.toContain("data-plate");
    expect(face("talos")).not.toContain("data-plate");
    expect(face("talos")).toContain("bg-[color:var(--card-anvil)]");
  });
  it("swaps to a logo's dark file in the dark theme", () => {
    expect(face("min-max")).toContain('src="/work/logos/min-max/mark-on-dark.svg"');
    expect(face("min-max")).toContain('src="/work/logos/min-max/mark.svg"');
  });
  it("draws the jobs card's five discs, This site's mark and a photo card's picture in its pane", () => {
    expect(face("jobs").match(/data-disc=/g)?.length).toBe(5);
    expect(face("this-site")).toContain("<svg");
    expect(face("mentorship")).toContain('data-face="photo"');
    expect(face("mentorship")).toContain('src="/photos/cards/mentorship-picture.jpg"');
  });
});

// The tile is a scaled copy of the painted card: every size and corner here must
// come out as the painter's own pixels (lib/coil/textures.ts) at its texture size.
describe("the header tile's face matches the painter's geometry", () => {
  const [textureW, textureH] = COIL.lab.textureSize;
  const dims = cardDims(COIL.lab.textureSize);
  const corner = /border-radius:([\d.]+)% \/ ([\d.]+)%/;
  const num = (value: string | undefined) => Number(value);

  it("rounds the pane at the painter's rim radius", () => {
    const [, across, down] = face("capital-one").match(corner) ?? [];
    expect((num(across) / 100) * textureW).toBeCloseTo(dims.radius, 6);
    expect((num(down) / 100) * textureH).toBeCloseTo(dims.radius, 6);
  });
  it("draws IEEE's square at the photo inset's width with the inset's corners", () => {
    const [, width, ratio, across, down] = face("ieee").match(/width:([\d.]+)%;aspect-ratio:([\d. /]+);border-radius:([\d.]+)% \/ ([\d.]+)%/) ?? [];
    const ieee = strandCardByKey.get("ieee")?.face;
    if (ieee?.kind !== "logo") throw new Error("ieee is not a logo face");
    const painted = containBox(ieee.logo.width / ieee.logo.height, textureW - dims.inset * 2);
    const boxW = (num(width) / 100) * textureW;
    const [ratioW, ratioH] = ratio.split("/").map(Number);
    expect(boxW).toBeCloseTo(painted.w, 6);
    expect(boxW * (ratioH / ratioW)).toBeCloseTo(painted.h, 6);
    expect((num(across) / 100) * boxW).toBeCloseTo(dims.innerRadius, 6);
    expect((num(down) / 100) * painted.h).toBeCloseTo(dims.innerRadius, 6);
  });
  it("rounds the dark theme's plate with the inset's corners", () => {
    const [, width, height, across, down] = face("capital-one").match(/style="width:([\d.]+)%;height:([\d.]+)%;border-radius:([\d.]+)% \/ ([\d.]+)%" data-plate=""/) ?? [];
    const capital = strandCardByKey.get("capital-one")?.face;
    if (capital?.kind !== "logo") throw new Error("capital-one is not a logo face");
    const painted = logoBox(capital.logo.width / capital.logo.height, textureW, COIL.face);
    const pad = textureW * COIL.face.plateInset;
    const plateW = (num(width) / 100) * textureW;
    const plateH = (num(height) / 100) * textureH;
    expect(plateW).toBeCloseTo(painted.w + 2 * pad, 6);
    expect(plateH).toBeCloseTo(painted.h + 2 * pad, 6);
    expect((num(across) / 100) * plateW).toBeCloseTo(dims.innerRadius, 6);
    expect((num(down) / 100) * plateH).toBeCloseTo(dims.innerRadius, 6);
  });
  it("reads the mark, the disc logos and the plate margin from COIL.face, so a retune reaches the tile", async () => {
    vi.resetModules();
    vi.doMock("@/lib/coil/constants", async () => {
      const real = await vi.importActual<typeof import("@/lib/coil/constants")>("@/lib/coil/constants");
      const retuned = { ...real.COIL, face: { ...real.COIL.face, markWidth: 0.5, plateInset: 0.2, circles: { ...real.COIL.face.circles, logo: 0.4 } } };
      return { ...real, COIL: retuned };
    });
    const { CardFace: Retuned } = await import("@/components/card/CardFace");
    const retuned = (key: CardKey) => {
      const f = strandCardByKey.get(key)?.face;
      if (!f) throw new Error(`${key} is not on the strand`);
      return renderToStaticMarkup(createElement(Retuned, { face: f }));
    };
    vi.doUnmock("@/lib/coil/constants");
    vi.resetModules();
    expect(retuned("this-site")).toContain("width:50%");
    expect(retuned("jobs")).toContain("max-width:40%;max-height:40%");
    expect(face("capital-one")).not.toBe(retuned("capital-one"));
  });
});

describe("the header", () => {
  it("carries the flight's slot: a photo card's only on a phone, every other card's in both layouts", () => {
    expect(header("mentorship", false)).not.toContain("data-tile-slot");
    expect(header("mentorship", true)).toContain('data-tile-slot="photo"');
    expect(header("talos", false)).toMatch(/data-tile-slot="work"[^>]*style="width:60px;height:80px"/);
    expect(header("talos", true)).toMatch(/data-tile-slot="work"[^>]*style="width:51px;height:68px"/);
    expect(header("capital-one", true)).toMatch(/data-tile-slot="work"[^>]*style="width:42px;height:56px"/);
  });
  it("shows IEEE's AO tip in the meta beside the rows, and the shorter meta on a phone", () => {
    expect(header("ieee", false)).toMatch(/<button [^>]*data-inline="tip" data-inline-key="ieee-ao"[^>]*>AO<\/button>/);
    expect(header("ieee", true)).toContain("President, 2023 to 2026");
    expect(header("ieee", true)).not.toContain("ieee-ao");
  });
});

describe("the timeline entry", () => {
  it("makes the employer's name its insider tip and shows the role and when", () => {
    const html = renderToStaticMarkup(createElement(TimelineEntry, { entry: 3, unit: 6 }));
    expect(html).toMatch(/<button [^>]*data-inline="tip" data-inline-key="job-3"[^>]*>Apple<\/button>/);
    expect(html).toContain("Specialist, then technical specialist");
    expect(html).toContain("2024 to 2025");
    expect(html).toContain('data-mask="words-6"');
  });
});

describe("the mentors and the links", () => {
  it("links each of the six mentors to LinkedIn in a new tab under my heading", () => {
    const html = renderToStaticMarkup(createElement(MentorsList, {}));
    expect(html).toContain("the people who shaped me");
    expect(html.match(/<a [^>]*href="https:\/\/www\.linkedin\.com\/in\/[^"]+" target="_blank" rel="noopener noreferrer"/g)?.length).toBe(6);
  });
  it("opens a card's links in a new tab, and renders nothing for a card with none", () => {
    expect(renderToStaticMarkup(createElement(CardLinks, { cardKey: "anthropic" }))).toMatch(/<a [^>]*href="https:\/\/txclaude.org" target="_blank" rel="noopener noreferrer"/);
    expect(renderToStaticMarkup(createElement(CardLinks, { cardKey: "min-max" }))).toBe("");
  });
});
