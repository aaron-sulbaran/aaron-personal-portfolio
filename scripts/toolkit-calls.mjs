// The pure half of the per-tool call counts in scripts/usage-snapshot.mjs: how
// often each skill, plugin and MCP server was called inside the snapshot
// window, read from Claude Code transcript rows. Only names on the curated
// public list (lib/metrics/toolkit-public.json) ever leave this module; every
// other tool still counts toward the group totals but is never named. Names and
// integers only: no prompt, argument, path or id is kept.

export function localDay(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function newTally() {
  return { skills: new Map(), plugins: new Map(), mcp: new Map(), seen: new Set() };
}

const bump = (map, name) => map.set(name, (map.get(name) ?? 0) + 1);
const safeName = /^[a-z0-9][a-z0-9_.:-]*$/;

// "plugin:skill" is the skill plus a call to its plugin; a bare name is a skill.
function skillCall(tally, raw) {
  if (typeof raw !== "string") return;
  const full = raw.trim().replace(/^\//, "").toLowerCase();
  if (!safeName.test(full)) return;
  const colon = full.indexOf(":");
  if (colon < 0) return bump(tally.skills, full);
  const plugin = full.slice(0, colon);
  const skill = full.slice(colon + 1);
  if (plugin) bump(tally.plugins, plugin);
  if (skill) bump(tally.skills, skill);
}

// A connector name as a server name: "claude_ai_Figma" is "figma",
// "claude_ai_Google_Calendar" is "google-calendar".
const connectorName = (raw) => raw.replace(/^claude_ai_/i, "").toLowerCase().replace(/_/g, "-");

// mcp__<server>__<tool>, or mcp__plugin_<plugin>_<server>__<tool> for a server
// a plugin ships ("plugin_chrome-devtools-mcp_chrome-devtools" is the plugin
// chrome-devtools-mcp and its server chrome-devtools).
function mcpCall(tally, toolName) {
  const segments = toolName.split("__");
  if (segments.length < 3 || !segments[1]) return;
  const middle = segments[1];
  if (middle.startsWith("plugin_")) {
    const rest = middle.slice("plugin_".length);
    const cut = rest.indexOf("_");
    if (cut <= 0 || cut === rest.length - 1) return;
    bump(tally.plugins, rest.slice(0, cut).toLowerCase());
    bump(tally.mcp, connectorName(rest.slice(cut + 1)));
    return;
  }
  bump(tally.mcp, connectorName(middle));
}

// Adds the calls in one transcript row to the tally, if the row is an
// assistant line on or after `since` (a local YYYY-MM-DD day). A tool_use block
// seen twice (a resumed or copied transcript) is counted once.
export function collectCalls(row, tally, since) {
  if (row?.type !== "assistant" || !Array.isArray(row.message?.content)) return;
  const day = localDay(row.timestamp);
  if (!day || day < since) return;
  for (const block of row.message.content) {
    if (block?.type !== "tool_use" || typeof block.name !== "string") continue;
    if (typeof block.id === "string") {
      if (tally.seen.has(block.id)) continue;
      tally.seen.add(block.id);
    }
    if (block.name === "Skill") skillCall(tally, block.input?.skill);
    else if (block.name.startsWith("mcp__")) mcpCall(tally, block.name);
  }
}

const GROUP_ORDER = ["written", "used", "plugin", "mcp"];

// The named tools: public-list entries only, with their call counts. An entry
// nobody called is kept at 0 only if it exists in the setup (`setup` is from
// setupNames in toolkit-counts.mjs), so a stale name on the list does not show.
export function namedToolkit(tally, publicList, setup) {
  const named = [];
  for (const entry of publicList) {
    const calls =
      entry.group === "plugin" ? tally.plugins.get(entry.name)
      : entry.group === "mcp" ? tally.mcp.get(entry.name)
      : tally.skills.get(entry.name);
    const exists =
      entry.group === "plugin" ? setup.plugins.has(entry.name)
      : entry.group === "mcp" ? setup.mcp.has(entry.name)
      : setup.skills.has(entry.name);
    if (!calls && !exists) continue;
    named.push({ name: entry.name, group: entry.group, calls: calls ?? 0 });
  }
  return named.sort(
    (a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group) || b.calls - a.calls || a.name.localeCompare(b.name),
  );
}
