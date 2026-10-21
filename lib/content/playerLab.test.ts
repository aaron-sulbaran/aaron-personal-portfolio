import { describe, expect, it } from "vitest";
import { walkStrings } from "@/lib/testing/walk";
import { BACK_UP, CREDIT, FOOTER, IDLE_RIPPLE, INTO_ISLE, NOT_NOW, ON_PLAY, PHONE, PHONE_MODEL, STATUS_LINE, WAVE_AFTER_ANSWER } from "@/lib/player/settings";
import { REPEAT_CYCLE } from "@/lib/player/queue";
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
    for (const option of STATUS_LINE) expect(playerLab.statusLine.names[option] && playerLab.statusLine.notes[option]).toBeTruthy();
    for (const option of NOT_NOW) expect(playerLab.notNow.names[option] && playerLab.notNow.notes[option]).toBeTruthy();
    for (const option of WAVE_AFTER_ANSWER) expect(playerLab.wave.names[option] && playerLab.wave.notes[option]).toBeTruthy();
    for (const option of FOOTER) expect(playerLab.footer.names[option] && playerLab.footer.notes[option]).toBeTruthy();
    for (const option of IDLE_RIPPLE) expect(playerLab.idle.names[option] && playerLab.idle.notes[option]).toBeTruthy();
    for (const option of PHONE_MODEL) expect(playerLab.phone.models[option]).toBeTruthy();
  });

  it("labels every repeat mode and every player control for a screen reader", () => {
    for (const mode of REPEAT_CYCLE) expect(playerStrings.repeat[mode]).toBeTruthy();
    for (const key of ["shuffle", "elapsed", "remaining", "seekValueOf", "pillOpen", "islandClose"] as const) expect(playerStrings[key]).toBeTruthy();
  });
});
