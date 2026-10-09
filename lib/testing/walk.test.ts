import { describe, expect, it } from "vitest";
import { walkStrings } from "@/lib/testing/walk";

describe("walkStrings", () => {
  it("collects every string with its path, skipping functions, numbers and nulls", () => {
    expect(walkStrings({ a: "x", b: ["y", { c: "z" }], f: () => "never", n: null, d: 3 })).toEqual([{ path: "a", text: "x" }, { path: "b[0]", text: "y" }, { path: "b[1].c", text: "z" }]);
  });

  it("reads a bare string as a leaf at the root", () => {
    expect(walkStrings("solo")).toEqual([{ path: "", text: "solo" }]);
  });
});
