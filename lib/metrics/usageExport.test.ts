import { describe, expect, it } from "vitest";
import { buildUsageExport } from "../../scripts/usage-export.mjs";
import publicList from "./toolkit-public.json";
import { toolTotal, usageExportSchema, usageSnapshotSchema } from "./usageSchema";
import snapshot from "./data/usage-6mo.json";

const counts = (n: number) => ({ in: n, out: n, cr: n, cw: n, msgs: 3 });
const cursor = { req: 0 };
const [listedA, listedB] = publicList;
const input = {
  generated: "2026-10-16T06:00:00.000Z",
  tz: "America/Chicago",
  tools: { claude: { unit: "tokens" }, codex: { unit: "tokens" }, cursor: { unit: "requests" } },
  toolkit: {
    customSkills: 18,
    installedSkills: 23,
    plugins: 7,
    mcpServers: 9,
    named: [
      { name: listedA.name, group: listedA.group, calls: 4 },
      { name: "secret-client-tool", group: "written", calls: 99 },
      { name: "acme-internal", group: "mcp", calls: 7 },
      { name: listedB.name, group: listedB.group, calls: 2 },
      // Listed name under the wrong group is not listed.
      { name: listedA.name, group: listedA.group === "mcp" ? "plugin" : "mcp", calls: 5 },
    ],
  },
  days: [
    { d: "2026-03-01", claude: counts(1), codex: counts(1), cursor },
    { d: "2026-10-01", claude: counts(10), codex: counts(5), cursor },
    { d: "2026-10-02", claude: counts(2), codex: counts(0), cursor },
  ],
};

describe("buildUsageExport", () => {
  const feed = buildUsageExport(input, publicList, { from: "2026-04-19" });

  it("keeps public-list names and drops every other, including a listed name under the wrong group", () => {
    expect(feed.toolkit.named).toEqual([
      { name: listedA.name, group: listedA.group, calls: 4 },
      { name: listedB.name, group: listedB.group, calls: 2 },
    ]);
    const text = JSON.stringify(feed);
    expect(text).not.toContain("secret-client-tool");
    expect(text).not.toContain("acme-internal");
  });

  it("writes one total per agent per day inside the window, and the group counts", () => {
    expect(feed.days).toEqual([
      { d: "2026-10-01", claude: 40, codex: 20 },
      { d: "2026-10-02", claude: 8, codex: 0 },
    ]);
    expect(feed.toolkit).toMatchObject({ customSkills: 18, installedSkills: 23, plugins: 7, mcpServers: 9 });
    expect(feed.version).toBe(1);
    expect(feed.generatedAt).toBe("2026-10-16T06:00:00.000Z");
  });

  it("carries no path, project or message field, and passes the schema the site reads it with", () => {
    const polluted = { ...input, projectDir: "/Users/x/clients/acme", days: input.days.map((d) => ({ ...d, cwd: "/Users/x", prompt: "hello" })) };
    const out = buildUsageExport(polluted, publicList);
    expect(JSON.stringify(out)).not.toMatch(/\/Users|acme|hello|cwd|prompt|projectDir/);
    expect(Object.keys(out).sort()).toEqual(["days", "generatedAt", "toolkit", "tz", "version"]);
    expect(usageExportSchema.safeParse(out).success).toBe(true);
  });

  it("refuses to write a file the site would reject", () => {
    expect(() => buildUsageExport({ ...input, generated: "yesterday" }, publicList)).toThrow();
  });

  it("agrees with the committed snapshot's totals for the same days", () => {
    const parsed = usageSnapshotSchema.parse(snapshot);
    const out = buildUsageExport(parsed, publicList);
    expect(out.days.reduce((n, d) => n + d.claude + d.codex, 0)).toBe(parsed.days.reduce((n, d) => n + toolTotal(d.claude) + toolTotal(d.codex), 0));
    for (const tool of out.toolkit.named) expect(publicList.some((p) => p.name === tool.name && p.group === tool.group)).toBe(true);
  });
});
