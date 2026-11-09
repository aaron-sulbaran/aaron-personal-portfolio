import { describe, expect, it } from "vitest";
import { formatRunTime, runTimeParts } from "./format";

describe("run time", () => {
  it.each([
    [0, "0m 00s"],
    [42_000, "0m 42s"],
    [42_999, "0m 42s"],
    [845_000, "14m 05s"],
    [3_725_000, "1h 02m 05s"],
    [Number.NaN, "0m 00s"],
    [-5000, "0m 00s"],
  ])("formats %s as %s", (ms, text) => {
    expect(formatRunTime(ms)).toBe(text);
  });

  it("splits into value and unit parts with the leading unit unpadded", () => {
    expect(runTimeParts(845_000)).toEqual([{ value: "14", unit: "m" }, { value: "05", unit: "s" }]);
    expect(runTimeParts(3_725_000)).toEqual([{ value: "1", unit: "h" }, { value: "02", unit: "m" }, { value: "05", unit: "s" }]);
  });
});
