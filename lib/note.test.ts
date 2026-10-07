import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { NOTE_INK, NOTE_SLASH_MS, hasSlash, noteState } from "./note";

describe("the note's state", () => {
  it("reads the soundtrack store", () => {
    expect(noteState("on")).toBe("playing");
    expect(noteState("paused")).toBe("paused");
    expect(noteState("off")).toBe("off");
    expect(noteState("before")).toBe("off");
  });
  it("is the accent while playing and muted otherwise; the slash takes the same ink", () => {
    expect(NOTE_INK).toEqual({ playing: "text-accent", paused: "text-muted", off: "text-muted" });
  });
  it("is slashed only while paused or off, drawn over 200ms", () => {
    expect([hasSlash("playing"), hasSlash("paused"), hasSlash("off")]).toEqual([false, true, true]);
    expect(NOTE_SLASH_MS).toBe(200);
  });
  it("globals.css draws the slash on the same 200ms", () => {
    const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
    expect(css).toContain(`--note-slash-ms: ${NOTE_SLASH_MS}ms;`);
    expect(css).not.toContain("note-sway");
  });
});
