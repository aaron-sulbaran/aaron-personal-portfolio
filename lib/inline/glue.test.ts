import { describe, expect, it } from "vitest";
import { inlineRuns, type InlineRun } from "@/lib/content/links";
import { glueRuns, type GlueItem } from "@/lib/inline/glue";

const known = () => true;
const group = (source: string): GlueItem[] => glueRuns(inlineRuns(source, known));
const texts = (runs: InlineRun[]) => runs.map((run) => run.text);

describe("glueRuns", () => {
  it("leaves plain copy as the runs it was given", () => {
    const runs = inlineRuns("I spent three summers at Capital One.", known);
    expect(glueRuns(runs)).toEqual([{ glue: false, run: runs[0] }]);
  });
  it("leaves a link with whitespace on both sides unglued", () => {
    const items = group("a [Rango](tip:rango) knockoff");
    expect(items.map((item) => item.glue)).toEqual([false, false, false]);
  });
  it("leaves a link at either string edge unglued", () => {
    expect(group("[Rango](tip:rango) knockoff").every((item) => !item.glue)).toBe(true);
    expect(group("a knockoff of [Rango](tip:rango)").every((item) => !item.glue)).toBe(true);
    expect(group("[Rango](tip:rango)")).toHaveLength(1);
  });
  it("glues the characters touching a link after it, splitting the text run at the whitespace", () => {
    const items = group("I am a [product](def:product)-focused engineer.");
    expect(items.map((item) => item.glue)).toEqual([false, true, false]);
    const glued = items[1];
    if (!glued.glue) throw new Error("expected a glue group");
    expect(texts(glued.runs)).toEqual(["product", "-focused"]);
    const before = items[0];
    const after = items[2];
    if (before.glue || after.glue) throw new Error("expected plain runs");
    expect(before.run.text).toBe("I am a ");
    expect(after.run.text).toBe(" engineer.");
  });
  it("glues the characters touching a link on both sides", () => {
    const items = group("go ([this](tip:a)) now");
    const glued = items.find((item) => item.glue);
    if (!glued || !glued.glue) throw new Error("expected a glue group");
    expect(texts(glued.runs)).toEqual(["(", "this", ")"]);
  });
  it("keeps the word and the footnote's period with the footnote button", () => {
    const items = group("building[*](tip:killer-drones). Next");
    const glued = items[0];
    if (!glued.glue) throw new Error("expected a glue group first");
    expect(texts(glued.runs)).toEqual(["building", "*", "."]);
    expect(items[1]).toMatchObject({ glue: false, run: { text: " Next" } });
  });
  it("puts adjacent links with no whitespace between them in one group", () => {
    const items = group("x [a](tip:a)[b](tip:b) y");
    expect(items.map((item) => item.glue)).toEqual([false, true, false]);
    const glued = items[1];
    if (!glued.glue) throw new Error("expected a glue group");
    expect(glued.runs.map((run) => run.kind)).toEqual(["tip", "tip"]);
  });
  it("keeps emphasis on a glued neighbour as its own run inside the group", () => {
    const items = group("**bold**[a](tip:a) rest");
    const glued = items[0];
    if (!glued.glue) throw new Error("expected a glue group");
    expect(glued.runs.map((run) => [run.text, run.strong])).toEqual([["bold", true], ["a", false]]);
  });
  it("treats a non breaking space as part of the glue", () => {
    const items = group("one [a](tip:a) two");
    const glued = items.find((item) => item.glue);
    expect(glued).toBeDefined();
  });
});
