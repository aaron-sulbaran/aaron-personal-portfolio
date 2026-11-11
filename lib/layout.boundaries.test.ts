import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BOUNDARY_NAMES } from "./clientErrors";

// A commented-out mount is not rendered, so JSX comments are removed before any matching.
const layout = readFileSync(join(process.cwd(), "app", "layout.tsx"), "utf8").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
const boundaryBodies = [...layout.matchAll(/<QuietBoundary\b[^>]*>([\s\S]*?)<\/QuietBoundary>/g)].map((match) => match[1]);
const insideBoundary = (name: string) => boundaryBodies.some((body) => new RegExp(`<${name}\\b`).test(body));
const rendered = (name: string) => new RegExp(`<${name}\\b`).test(layout);

const INSIDE = ["SoundtrackPlayer", "CustomCursor", "InlineLayer", "QuestMount", "TransitionLayer"];
const OUTSIDE = ["TopFade", "SiteLogo", "MenuPill", "InputModality", "SiteAnalytics", "ClientErrorListener"];
const STRUCTURE = ["QuietBoundary"];
const markup = layout.slice(layout.indexOf("return ("));

const PAIRS = { player: "SoundtrackPlayer", cursor: "CustomCursor", inline: "InlineLayer", quests: "QuestMount", transition: "TransitionLayer" };
const boundaries = [...layout.matchAll(/<QuietBoundary\s+where="([^"]+)"[^>]*>\s*<([A-Z][A-Za-z0-9]*)/g)].map((match) => [match[1], match[2]]);

describe("root layout boundaries", () => {
  it("pairs each boundary name with its own mount", () => {
    expect(Object.fromEntries(boundaries)).toEqual(PAIRS);
    expect(boundaries).toHaveLength(Object.keys(PAIRS).length);
  });

  it("uses every boundary name once and no other", () => {
    expect(boundaries.map(([where]) => where).sort()).toEqual([...BOUNDARY_NAMES].sort());
  });

  it("classifies every capitalized tag the layout renders, so a new mount cannot slip in unnoticed", () => {
    const tags = new Set([...markup.matchAll(/<([A-Z][A-Za-z0-9]*)\b/g)].map((match) => match[1]));
    expect(tags.size).toBeGreaterThan(0);
    const unclassified = [...tags].filter((tag) => ![...INSIDE, ...OUTSIDE, ...STRUCTURE].includes(tag));
    expect(unclassified).toEqual([]);
  });

  it.each(INSIDE)(
    "%s is non-essential and sits inside a QuietBoundary",
    (name) => {
      expect(rendered(name)).toBe(true);
      expect(insideBoundary(name)).toBe(true);
    },
  );

  it.each(OUTSIDE)(
    "%s is chrome or measurement and stays outside every QuietBoundary",
    (name) => {
      expect(rendered(name)).toBe(true);
      expect(insideBoundary(name)).toBe(false);
    },
  );
});
