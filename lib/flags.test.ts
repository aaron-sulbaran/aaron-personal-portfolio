import { describe, expect, it } from "vitest";
import { parseHomeHero } from "@/lib/flags";

describe("parseHomeHero", () => {
  it("serves the Coil by default; only the exact 'ring' value opts back in", () => {
    expect(parseHomeHero(undefined)).toBe("coil");
    expect(parseHomeHero("")).toBe("coil");
    expect(parseHomeHero("coil")).toBe("coil");
    expect(parseHomeHero("Ring")).toBe("coil");
    expect(parseHomeHero(" ring")).toBe("coil");
    expect(parseHomeHero("ring")).toBe("ring");
  });
});
