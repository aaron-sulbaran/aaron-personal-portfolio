import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const layout = readFileSync(join(process.cwd(), "app", "layout.tsx"), "utf8");
const boundaryBodies = [...layout.matchAll(/<QuietBoundary\b[^>]*>([\s\S]*?)<\/QuietBoundary>/g)].map((match) => match[1]);
const insideBoundary = (name: string) => boundaryBodies.some((body) => new RegExp(`<${name}\\b`).test(body));
const rendered = (name: string) => new RegExp(`<${name}\\b`).test(layout);

describe("root layout boundaries", () => {
  it.each(["SoundtrackPlayer", "CustomCursor", "InlineLayer", "QuestMount", "TransitionLayer"])(
    "%s is non-essential and sits inside a QuietBoundary",
    (name) => {
      expect(rendered(name)).toBe(true);
      expect(insideBoundary(name)).toBe(true);
    },
  );

  it.each(["TopFade", "SiteLogo", "MenuPill", "InputModality", "SiteAnalytics"])(
    "%s is chrome or measurement and stays outside every QuietBoundary",
    (name) => {
      expect(rendered(name)).toBe(true);
      expect(insideBoundary(name)).toBe(false);
    },
  );
});
