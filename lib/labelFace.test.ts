import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import config from "@/tailwind.config";

type Size = [string, Record<string, string>];
const extend = config.theme!.extend! as unknown as { fontSize: Record<string, Size>; fontFamily: Record<string, unknown> };

describe("the label face tokens", () => {
  it("has exactly three label sizes in the Tailwind config", () => {
    expect(Object.keys(extend.fontSize).filter((key) => key.startsWith("label")).sort()).toEqual(["label", "label-lg", "label-sm"]);
  });

  it("sets size, tracking and weight on every step; only label carries a line height", () => {
    expect(extend.fontSize["label-sm"]).toEqual(["0.795rem", { letterSpacing: "0.01em", fontWeight: "700" }]);
    expect(extend.fontSize.label).toEqual(["0.9275rem", { lineHeight: "1.25rem", letterSpacing: "0.01em", fontWeight: "700" }]);
    expect(extend.fontSize["label-lg"]).toEqual(["1.1925rem", { letterSpacing: "0.01em", fontWeight: "700" }]);
  });

  it("puts Profa Bold first in font-label, then Inter, with Inter's features reset", () => {
    expect(extend.fontFamily.label).toEqual([
      ["var(--font-label)", "var(--font-sans)", "system-ui", "sans-serif"],
      { fontFeatureSettings: "normal" },
    ]);
  });

  it("loads the tracked Bold cut onto --font-label on <html>", () => {
    const fonts = readFileSync("lib/fonts.ts", "utf8");
    expect(fonts).toContain('src: "../app/fonts/ProfaTrial-Bold.ttf"');
    expect(fonts).toContain('variable: "--font-label"');
    expect(readFileSync(".gitignore", "utf8").split("\n")).toContain("!app/fonts/ProfaTrial-Bold.ttf");
    expect(existsSync("app/fonts/ProfaTrial-Bold.ttf")).toBe(true);
    expect(readFileSync("app/layout.tsx", "utf8")).toContain("profaBold.variable");
  });
});

describe("copy stays in lib/content.ts", () => {
  it("leaves no hard-coded close hint in the definition modal", () => {
    expect(readFileSync("components/DefinitionModal.tsx", "utf8")).not.toContain("Press Esc to close");
  });
});

describe("the playback pill and player card", () => {
  it("take the label face from classes, never inline font styles", () => {
    for (const file of ["PlaybackPill", "PillParts", "PillLabel", "PlayerCard"]) {
      const source = readFileSync(`components/soundtrack/${file}.tsx`, "utf8");
      expect(source, file).not.toContain("var(--font-sans)");
      expect(source, file).not.toMatch(/fontSize: 1[0-2]\b/);
      expect(source, file).not.toMatch(/fontWeight: 500/);
    }
  });
});
