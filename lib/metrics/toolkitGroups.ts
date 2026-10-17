import publicList from "./toolkit-public.json";
import { TOOL_GROUPS, type NamedTool, type Toolkit, type ToolGroup } from "./usageSchema";

export type ToolkitName = { name: string; label: string; calls: number; marked: boolean };
export type ToolkitGroup = { group: ToolGroup; count: number; names: ToolkitName[] };

// The most-used tools in a group wear their call count: the top MARKED_TOP of
// them, once they pass MARKED_MIN_CALLS.
export const MARKED_TOP = 3;
export const MARKED_MIN_CALLS = 5;

// Display names from the public list, where a nicer one than the folder name is wanted.
export const PUBLIC_LABELS: Record<string, string> = Object.fromEntries(
  (publicList as { name: string; label?: string }[]).filter((entry) => entry.label).map((entry) => [entry.name, entry.label as string]),
);

// Skills are invoked as slash commands, so that is how they read; plugins and
// MCP servers keep their plain names. Display only: the data keeps the slugs.
const SKILL_GROUPS: readonly ToolGroup[] = ["written", "used"];
export const displayName = (group: ToolGroup, name: string): string => (SKILL_GROUPS.includes(group) ? `/${name}` : name);

// "×41": the multiplication sign, U+00D7.
export const toolkitCallLabel = (calls: number): string => `×${calls}`;

// The group's total comes from the whole setup's counts, so it includes tools
// that are never named; `names` are only the public ones, most called first.
const totalOf = (toolkit: Toolkit, group: ToolGroup): number => {
  switch (group) {
    case "written": return toolkit.customSkills;
    case "used": return toolkit.installedSkills;
    case "plugin": return toolkit.plugins;
    case "mcp": return toolkit.mcpServers;
  }
};

const byUse = (a: NamedTool, b: NamedTool) => b.calls - a.calls || a.name.localeCompare(b.name);

export function groupToolkit(toolkit: Toolkit, labels: Record<string, string> = PUBLIC_LABELS): ToolkitGroup[] {
  return TOOL_GROUPS.map((group) => {
    const ordered = toolkit.named.filter((tool) => tool.group === group).sort(byUse);
    return {
      group,
      count: totalOf(toolkit, group),
      names: ordered.map((tool, index) => ({
        name: tool.name,
        label: labels[tool.name] ?? displayName(group, tool.name),
        calls: tool.calls,
        marked: index < MARKED_TOP && tool.calls >= MARKED_MIN_CALLS,
      })),
    };
  });
}
