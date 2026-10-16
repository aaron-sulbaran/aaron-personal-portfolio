import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ToolkitBand } from "@/components/metrics/ToolkitBand";
import { siteContent } from "@/lib/content";
import { toolkitTotal } from "./format";
import { DEFAULT_LABELS } from "./labels";
import { TOKENS } from "./settings";
import { loadUsage } from "./usage";

// The band as the server renders it: the total, four groups in order, names by use.
const toolkit = loadUsage().toolkit;
const CAP = TOKENS.namesPerGroup;
const html = renderToStaticMarkup(createElement(ToolkitBand, { toolkit, labels: DEFAULT_LABELS, namesPerGroup: CAP }));
const group = (name: string) => html.slice(html.indexOf(`data-toolkit-group="${name}"`)).split("</section>")[0];

describe("the toolkit band", () => {
  it("leads with the whole setup's total and its title", () => {
    expect(html).toMatch(new RegExp(`data-toolkit-total="" class="[^"]*">${toolkitTotal(toolkit)}<`));
    expect(html).toContain(DEFAULT_LABELS.toolkitTitle);
    expect(html).toContain("data-toolkit-band");
  });

  it("holds the four groups in order, each headed by its name and its count", () => {
    const order = ["written", "used", "plugin", "mcp"];
    const at = order.map((name) => html.indexOf(`data-toolkit-group="${name}"`));
    expect(at.every((n) => n > 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    const counts = [toolkit.customSkills, toolkit.installedSkills, toolkit.plugins, toolkit.mcpServers];
    const names = [DEFAULT_LABELS.groupWritten, DEFAULT_LABELS.groupUsed, DEFAULT_LABELS.groupPlugin, DEFAULT_LABELS.groupMcp];
    order.forEach((name, i) => {
      expect(group(name)).toMatch(new RegExp(`data-toolkit-count="" class="[^"]*">${counts[i]}<`));
      expect(group(name)).toContain(names[i]);
      expect(group(name)).toMatch(/<h4 /);
    });
  });

  it("lists names as list items, the most used first, with a call count on the marked ones in muted type", () => {
    const written = group("written");
    expect(written).toContain("<ul ");
    const first = written.indexOf('data-toolkit-name="');
    expect(written.slice(first, first + 60)).toContain(toolkit.named.filter((t) => t.group === "written").sort((a, b) => b.calls - a.calls)[0].name);
    expect(written).toMatch(/<span class="ml-1\.5 text-muted">×\d+<\/span>/);
    expect(written.match(/×\d+/g)).toHaveLength(3);
  });

  it("names the top five of each group by default, as slash commands for the two skill groups", () => {
    expect(CAP).toBe(5);
    for (const name of ["written", "used", "plugin", "mcp"] as const) expect(group(name).match(/data-toolkit-name="/g)).toHaveLength(5);
    expect(group("written")).toContain('data-toolkit-name="sync-granola" class="[overflow-wrap:anywhere]">/sync-granola');
    expect(group("used")).toContain(">/frontend-design");
    expect(group("used")).not.toContain("dataviz");
    expect(group("plugin")).not.toContain("chrome-devtools");
    expect(group("plugin")).toContain(">superpowers");
    expect(group("mcp")).toContain(">chrome-devtools");
    expect(group("mcp")).not.toContain(">/");
  });

  it("follows the cap: a bigger one names more and folds fewer into '+N more'", () => {
    const wide = renderToStaticMarkup(createElement(ToolkitBand, { toolkit, labels: DEFAULT_LABELS, namesPerGroup: 15 }));
    const wideGroup = wide.slice(wide.indexOf('data-toolkit-group="written"')).split("</section>")[0];
    expect(wideGroup.match(/data-toolkit-name="/g)).toHaveLength(Math.min(15, toolkit.named.filter((t) => t.group === "written").length));
    const narrow = renderToStaticMarkup(createElement(ToolkitBand, { toolkit, labels: DEFAULT_LABELS, namesPerGroup: 3 }));
    const narrowGroup = narrow.slice(narrow.indexOf('data-toolkit-group="written"')).split("</section>")[0];
    expect(narrowGroup.match(/data-toolkit-name="/g)).toHaveLength(3);
    expect(narrowGroup).toContain(siteContent.metrics.tokens.toolkitMore(toolkit.customSkills - 3));
  });

  it("ends a group with a muted '+N more' for the tools it counts but does not name", () => {
    for (const name of ["written", "used", "plugin", "mcp"] as const) {
      const named = Math.min(CAP, toolkit.named.filter((t) => t.group === name).length);
      const total = { written: toolkit.customSkills, used: toolkit.installedSkills, plugin: toolkit.plugins, mcp: toolkit.mcpServers }[name];
      if (total > named) expect(group(name)).toContain(`<li class="text-muted">${siteContent.metrics.tokens.toolkitMore(total - named)}</li>`);
      else expect(group(name)).not.toContain("more</li>");
    }
  });

  it("uses a group's edited name from the labels", () => {
    const renamed = renderToStaticMarkup(createElement(ToolkitBand, { toolkit, labels: { ...DEFAULT_LABELS, groupMcp: "Servers", toolkitTitle: "tools I run" }, namesPerGroup: CAP }));
    expect(renamed).toContain(">Servers<");
    expect(renamed).toContain(">tools I run<");
  });
});
