import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const layout = readFileSync(join(process.cwd(), "app", "layout.tsx"), "utf8");
const boundaryBodies = [...layout.matchAll(/<QuietBoundary\b[^>]*>([\s\S]*?)<\/QuietBoundary>/g)].map((match) => match[1]);
const insideBoundary = (name: string) => boundaryBodies.some((body) => new RegExp(`<${name}\\b`).test(body));
const rendered = (name: string) => new RegExp(`<${name}\\b`).test(layout);

const INSIDE = ["SoundtrackPlayer", "CustomCursor", "InlineLayer", "QuestMount", "TransitionLayer"];
const OUTSIDE = ["TopFade", "SiteLogo", "MenuPill", "InputModality", "SiteAnalytics", "ClientErrorListener"];
const STRUCTURE = ["QuietBoundary"];
const markup = layout.slice(layout.indexOf("return ("));

describe("root layout boundaries", () => {
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
