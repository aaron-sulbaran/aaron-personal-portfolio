import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LETTER_PATHS, TEE_PATH } from "./lockup";
import { seek, STING } from "./sting";

const file = (name: string) => readFileSync(join(process.cwd(), "public/work/logos/talos", name), "utf8");
const letters = (svg: string) => [...svg.matchAll(/<path class="ink" d="([^"]+)"/g)].map((m) => m[1]);

describe("the sting's lockup geometry", () => {
  it("is the kit's lockup in both cuts: the same four letters and the same T", () => {
    for (const cut of ["lockup-light.svg", "lockup-dark.svg"]) {
      const svg = file(cut);
      expect(letters(svg), cut).toEqual([...LETTER_PATHS]);
      expect(svg, cut).toContain(`d="${TEE_PATH}"`);
    }
    expect(file("mark.svg")).toContain(`d="${TEE_PATH}"`);
  });
  it("differs between the cuts only in the letters' colour", () => {
    const strip = (svg: string) => svg.replace(/#12141F|#ECE8E1/g, "ink");
    expect(strip(file("lockup-light.svg"))).toBe(strip(file("lockup-dark.svg")));
  });
});

describe("the sting's last frame", () => {
  const last = seek(STING.durationMs);
  it("is the plain lockup: coin whole, no scope, no die, the word home and unmasked", () => {
    expect(last.struck).toBe(true);
    expect(last.coinScale).toBe(1);
    expect(last.scope).toBeNull();
    expect(last.dieY).toBeNull();
    expect(last.wordDone).toBe(true);
    expect(last.letterShift).toEqual([0, 0, 0, 0]);
  });
  it("clamps past the end and before the start", () => {
    expect(seek(STING.durationMs + 5000)).toEqual(last);
    expect(seek(-40).tMs).toBe(0);
  });
});
