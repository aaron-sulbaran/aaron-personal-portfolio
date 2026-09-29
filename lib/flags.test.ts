import { describe, expect, it } from "vitest";
import { parseHomeHero } from "@/lib/flags";

describe("parseHomeHero", () => {
  it("serves the ring by default; only the exact 'coil' value opts in", () => {
    expect(parseHomeHero(undefined)).toBe("ring");
    expect(parseHomeHero("")).toBe("ring");
    expect(parseHomeHero("ring")).toBe("ring");
    expect(parseHomeHero("Coil")).toBe("ring");
    expect(parseHomeHero(" coil")).toBe("ring");
    expect(parseHomeHero("coil")).toBe("coil");
  });
});
