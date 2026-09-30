import { describe, expect, it } from "vitest";
import { COMPOSITE_FRAG, DEFAULT_NAME_FILL, NAME_FILLS, parseNameFill } from "@/lib/coil/field.glsl";

describe("name fills", () => {
  it("parses only the known keys, else the default", () => {
    for (const key of NAME_FILLS) expect(parseNameFill(key)).toBe(key);
    for (const junk of [null, undefined, "", "Grain", "green", "grain "]) expect(parseNameFill(junk)).toBe(DEFAULT_NAME_FILL);
  });

  it("keeps solid last, the mode index the shader skips", () => {
    expect(NAME_FILLS.indexOf("solid")).toBe(6);
    expect(COMPOSITE_FRAG).toContain("mode != 6");
  });

  it("interpolates every tuned value into the shader (no template left behind)", () => {
    expect(COMPOSITE_FRAG).not.toContain("${");
    expect(COMPOSITE_FRAG).not.toContain("NAME_FILL");
  });
});
