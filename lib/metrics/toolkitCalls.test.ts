import { describe, expect, it } from "vitest";
import { collectCalls, localDay, namedToolkit, newTally } from "../../scripts/toolkit-calls.mjs";

const noon = "2026-10-10T12:00:00";
const row = (blocks: unknown[], timestamp = noon, type = "assistant") => ({ type, timestamp, message: { content: blocks } });
const call = (name: string, input: unknown = {}, id?: string) => ({ type: "tool_use", name, input, ...(id ? { id } : {}) });
const skill = (name: string, id?: string) => call("Skill", { skill: name }, id);
const since = "2026-10-01";

const tally = (rows: unknown[]) => {
  const t = newTally();
  for (const r of rows) collectCalls(r, t, since);
  return t;
};
const asObject = (map: Map<string, number>) => Object.fromEntries(map);

describe("collecting calls from transcript rows", () => {
  it("counts a bare skill, and credits a plugin skill to both the skill and its plugin", () => {
    const t = tally([row([skill("living-docs"), skill("superpowers:brainstorming")]), row([skill("superpowers:writing-plans"), skill("living-docs")])]);
    expect(asObject(t.skills)).toEqual({ "living-docs": 2, brainstorming: 1, "writing-plans": 1 });
    expect(asObject(t.plugins)).toEqual({ superpowers: 2 });
  });

  it("sums MCP calls per server across tools", () => {
    const t = tally([row([call("mcp__context7__query-docs"), call("mcp__context7__resolve-library-id"), call("mcp__granola__list_meetings")])]);
    expect(asObject(t.mcp)).toEqual({ context7: 2, granola: 1 });
    expect(asObject(t.plugins)).toEqual({});
  });

  it("splits a plugin-prefixed MCP server into plugin and server, and credits both", () => {
    const t = tally([row([call("mcp__plugin_chrome-devtools-mcp_chrome-devtools__click"), call("mcp__plugin_vercel_vercel__list_projects"), call("mcp__vercel__x")])]);
    expect(asObject(t.mcp)).toEqual({ "chrome-devtools": 1, vercel: 2 });
    expect(asObject(t.plugins)).toEqual({ "chrome-devtools-mcp": 1, vercel: 1 });
  });

  it("lowercases a connector name: claude_ai_Figma is figma", () => {
    const t = tally([row([call("mcp__claude_ai_Figma__get_design_context"), call("mcp__claude_ai_Google_Calendar__list_events")])]);
    expect(asObject(t.mcp)).toEqual({ figma: 1, "google-calendar": 1 });
  });

  it("ignores other tools, user rows and malformed names", () => {
    const t = tally([
      row([call("Bash", { command: "ls" }), call("Read"), call("mcp__"), call("mcp__only"), call("mcp__plugin_nounderscore__x")]),
      row([skill("living-docs")], noon, "user"),
      row([skill("   ")]),
      { type: "assistant", timestamp: noon, message: { content: "plain text" } },
      { type: "assistant", timestamp: "garbage", message: { content: [skill("living-docs")] } },
    ]);
    expect(asObject(t.skills)).toEqual({});
    expect(asObject(t.mcp)).toEqual({});
    expect(asObject(t.plugins)).toEqual({});
  });

  it("cuts off at the window start, by local day", () => {
    const t = tally([
      row([skill("living-docs")], "2026-09-30T12:00:00"),
      row([skill("living-docs")], "2026-10-01T00:30:00"),
      row([skill("living-docs")], "2026-10-02T12:00:00"),
    ]);
    expect(t.skills.get("living-docs")).toBe(2);
    expect(localDay("2026-10-01T00:30:00")).toBe("2026-10-01");
    expect(localDay("not a date")).toBeNull();
  });

  it("counts a repeated tool_use id once", () => {
    const t = tally([row([skill("living-docs", "toolu_1")]), row([skill("living-docs", "toolu_1")]), row([skill("living-docs", "toolu_2")])]);
    expect(t.skills.get("living-docs")).toBe(2);
  });
});

describe("the public list filter", () => {
  const publicList = [
    { name: "living-docs", group: "written" },
    { name: "brainstorming", group: "used" },
    { name: "superpowers", group: "plugin" },
    { name: "context7", group: "mcp" },
    { name: "never-called", group: "written" },
    { name: "stale-name", group: "written" },
  ] as const;
  const setup = {
    skills: new Set(["living-docs", "brainstorming", "never-called", "aaron-context", "hiring-tool"]),
    plugins: new Set(["superpowers", "hiring-plugin"]),
    mcp: new Set(["context7", "gmail"]),
  };
  const t = tally([
    row([skill("living-docs"), skill("living-docs"), skill("superpowers:brainstorming"), skill("aaron-context"), skill("hiring-tool")]),
    row([call("mcp__context7__query-docs"), call("mcp__gmail__send"), call("mcp__plugin_hiring-plugin_inbox__read")]),
  ]);

  it("names only the listed tools, with their calls", () => {
    expect(namedToolkit(t, publicList, setup)).toEqual([
      { name: "living-docs", group: "written", calls: 2 },
      { name: "never-called", group: "written", calls: 0 },
      { name: "brainstorming", group: "used", calls: 1 },
      { name: "superpowers", group: "plugin", calls: 1 },
      { name: "context7", group: "mcp", calls: 1 },
    ]);
  });

  it("never lets an unlisted name reach the output, while the tally still holds it", () => {
    const out = JSON.stringify(namedToolkit(t, publicList, setup));
    for (const secret of ["aaron-context", "hiring-tool", "hiring-plugin", "gmail", "inbox", "stale-name"]) {
      expect(out).not.toContain(secret);
    }
    expect(t.skills.get("aaron-context")).toBe(1);
    expect(t.mcp.get("gmail")).toBe(1);
  });

  it("sorts by group, then calls descending, then name", () => {
    const list = ["b", "a", "c"].map((name) => ({ name, group: "written" as const }));
    const tt = tally([row([skill("c"), skill("c"), skill("a"), skill("b")])]);
    expect(namedToolkit(tt, list, { skills: new Set(), plugins: new Set(), mcp: new Set() }).map((x) => x.name)).toEqual(["c", "a", "b"]);
  });
});
