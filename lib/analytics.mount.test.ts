import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const sourceDirs = ["app", "components", "lib"];
const sourceFile = /\.(ts|tsx)$/;
const allowedImporter = join("components", "SiteAnalytics.tsx");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const sources = sourceDirs
  .flatMap((dir) => walk(join(root, dir)))
  .filter((file) => sourceFile.test(file) && !/\.test\.tsx?$/.test(file));

describe("analytics mounts exactly once", () => {
  it("the root layout renders SiteAnalytics once and never the bare vendor component", () => {
    const layout = readFileSync(join(root, "app", "layout.tsx"), "utf8");
    expect(layout).toMatch(/import \{ SiteAnalytics \} from "@\/components\/SiteAnalytics"/);
    expect(layout.match(/<SiteAnalytics\b/g)).toHaveLength(1);
    expect(layout).not.toMatch(/@vercel\/analytics/);
    expect(layout).not.toMatch(/<Analytics\b/);
  });

  it("only SiteAnalytics imports @vercel/analytics, so no unfiltered page view can ship", () => {
    const importers = sources
      .filter((file) => readFileSync(file, "utf8").includes("@vercel/analytics"))
      .map((file) => relative(root, file));
    expect(importers).toEqual([allowedImporter]);
  });
});
