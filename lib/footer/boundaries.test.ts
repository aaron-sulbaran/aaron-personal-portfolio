import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// The footer's bundle boundaries, read from its sources: three lives only in
// the CoilScene chunk, and the field's shaders and WebGL code reach the page
// only through the field's chunk (components/footer/gl, asked for by
// import()). e2e/footer.spec.ts holds the built chunks to the same.

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const list = (dir: string) =>
  readdirSync(join(ROOT, dir))
    .filter((f) => /\.tsx?$/.test(f))
    .map((f) => `${dir}/${f}`);
const SOURCES = [...list("lib/footer"), ...list("components/footer"), ...list("components/footer/gl"), "components/Footer.tsx"].filter((f) => !f.endsWith(".test.ts"));
const read = (f: string) => readFileSync(join(ROOT, f), "utf8");

describe("the footer's boundaries", () => {
  it("never imports three or the Coil's three-side modules", () => {
    for (const f of SOURCES) expect(read(f), f).not.toMatch(/from "(three|@\/lib\/coil\/(theme|textures|material)|@\/components\/coil\/scene\/[^"]*)"/);
  });

  it("imports the hero's shaders only in the field's chunk", () => {
    const chunk = (f: string) => f.startsWith("components/footer/gl/") || f === "lib/footer/shaders.ts";
    for (const f of SOURCES.filter((s) => !chunk(s))) {
      const src = read(f);
      expect(src, f).not.toMatch(/from "(@\/lib\/coil\/field\.glsl|@\/lib\/footer\/shaders|\.\/shaders)"/);
      expect(src, f).not.toMatch(/^import (?!type )[^;]*from "\.\/gl\//m);
    }
    expect(read("components/footer/FooterField.tsx")).toContain('import("./gl/footerFieldGl")');
  });
});
