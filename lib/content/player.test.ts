import { describe, expect, it } from "vitest";
import { REPEAT_CYCLE } from "@/lib/player/queue";
import { walkStrings } from "@/lib/testing/walk";
import { playerStrings } from "./player";

const leaves = [...walkStrings(playerStrings)];

describe("the soundtrack player's words", () => {
  it("never use an em dash", () => {
    expect(leaves.filter((leaf) => leaf.text.includes("—")).map((leaf) => leaf.path)).toEqual([]);
  });

  it("never speak of licensing, royalties or copyright", () => {
    expect(leaves.filter((leaf) => /licen[sc]|royalt|copyright/i.test(leaf.text)).map((leaf) => leaf.path)).toEqual([]);
  });

  it("labels every repeat mode and every player control for a screen reader", () => {
    for (const mode of REPEAT_CYCLE) expect(playerStrings.repeat[mode]).toBeTruthy();
    for (const key of ["shuffle", "seekValueOf", "pillOpen", "islandOpen", "islandClose"] as const) expect(playerStrings[key]).toBeTruthy();
  });
});
