import { describe, expect, it } from "vitest";
import { walkStrings } from "@/lib/testing/walk";
import { BACK_UP, CREDIT, INTO_ISLE, ON_PLAY, PHONE } from "@/lib/player/settings";
import { playerLab, playerStrings } from "./playerLab";

const leaves = [...walkStrings(playerLab), ...walkStrings(playerStrings)];

describe("the music player lab's words", () => {
  it("never use an em dash", () => {
    expect(leaves.filter((leaf) => leaf.text.includes("—")).map((leaf) => leaf.path)).toEqual([]);
  });

  it("never speak of licensing, royalties or copyright", () => {
    expect(leaves.filter((leaf) => /licen[sc]|royalt|copyright/i.test(leaf.text)).map((leaf) => leaf.path)).toEqual([]);
  });

  it("name and explain every option the settings offer", () => {
    for (const option of ON_PLAY) expect(playerLab.onPlay.names[option] && playerLab.onPlay.notes[option]).toBeTruthy();
    for (const option of INTO_ISLE) expect(playerLab.intoIsle.names[option] && playerLab.intoIsle.notes[option]).toBeTruthy();
    for (const option of BACK_UP) expect(playerLab.backUp.names[option] && playerLab.backUp.notes[option]).toBeTruthy();
    for (const option of CREDIT) expect(playerLab.credit.names[option] && playerLab.credit.notes[option]).toBeTruthy();
    for (const option of PHONE) expect(playerLab.phone.names[option] && playerLab.phone.notes[option]).toBeTruthy();
  });
});
