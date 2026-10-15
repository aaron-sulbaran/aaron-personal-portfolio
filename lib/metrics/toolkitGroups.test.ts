import { describe, expect, it } from "vitest";
import snapshot from "./data/usage-6mo.json";
import publicList from "./toolkit-public.json";
import { groupToolkit, MARKED_MIN_CALLS, MARKED_TOP, toolkitCallLabel } from "./toolkitGroups";
import { toolkitSchema, type Toolkit } from "./usageSchema";

const toolkit: Toolkit = {
  customSkills: 18,
  installedSkills: 23,
  plugins: 7,
  mcpServers: 9,
  named: [
    { name: "a", group: "written", calls: 2 },
    { name: "b", group: "written", calls: 41 },
    { name: "c", group: "written", calls: 41 },
    { name: "d", group: "written", calls: 7 },
    { name: "e", group: "written", calls: 5 },
    { name: "f", group: "used", calls: 4 },
    { name: "g", group: "used", calls: 3 },
    { name: "h", group: "mcp", calls: 12 },
  ],
};

describe("grouping the toolkit", () => {
  const groups = groupToolkit(toolkit);

  it("returns the four groups in order, with each group's total from the whole setup", () => {
    expect(groups.map((g) => [g.group, g.count])).toEqual([["written", 18], ["used", 23], ["plugin", 7], ["mcp", 9]]);
  });

  it("orders names by calls, then name, so a group can name fewer tools than it counts", () => {
    expect(groups[0].names.map((n) => n.name)).toEqual(["b", "c", "d", "e", "a"]);
    expect(groups[2].names).toEqual([]);
  });

  it("marks the top three of a group that were called at least five times", () => {
    expect(MARKED_TOP).toBe(3);
    expect(MARKED_MIN_CALLS).toBe(5);
    expect(groups[0].names.map((n) => n.marked)).toEqual([true, true, true, false, false]);
    expect(groups[1].names.map((n) => n.marked)).toEqual([false, false]);
    expect(groups[3].names.map((n) => n.marked)).toEqual([true]);
  });

  it("uses a label when one is given, else the name", () => {
    const labelled = groupToolkit(toolkit, { b: "Bee" });
    expect(labelled[0].names.map((n) => n.label)).toEqual(["Bee", "c", "d", "e", "a"]);
  });

  it("writes a call count with the multiplication sign", () => {
    expect(toolkitCallLabel(41)).toBe("×41");
    expect(toolkitCallLabel(41).codePointAt(0)).toBe(0xd7);
  });
});

describe("the committed toolkit", () => {
  const NEVER = [
    "aaron-context", "study-guide", "sync-school", "ask", "sort-inbox", "ingest", "google-tasks", "gmail", "google-calendar",
    "google-drive", "notion", "computer-use", "claude-in-chrome", "control-chrome", "hiring", "resume",
  ];

  it("names only tools on the public list, in the group the list gives them", () => {
    const parsed = toolkitSchema.parse(snapshot.toolkit);
    const allowed = new Set(publicList.map((entry) => `${entry.group}:${entry.name}`));
    for (const tool of parsed.named) expect(allowed.has(`${tool.group}:${tool.name}`)).toBe(true);
  });

  it("never names a tool Aaron ruled out, in the list or the snapshot", () => {
    const committed = JSON.stringify(snapshot.toolkit);
    const list = JSON.stringify(publicList);
    for (const name of NEVER) {
      expect(committed).not.toContain(`"${name}"`);
      expect(list).not.toContain(`"${name}"`);
    }
  });

  it("keeps the public list well formed: unique per group, schema-safe names", () => {
    const keys = publicList.map((entry) => `${entry.group}:${entry.name}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const entry of publicList) expect(entry.name).toMatch(/^[a-z0-9][a-z0-9-]*$/);
  });
});
