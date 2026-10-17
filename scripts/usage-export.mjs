// The pure half of `--export` in scripts/usage-snapshot.mjs: turns the full
// snapshot into the public-safe daily feed, and validates it with the schema
// the site reads it back with. Only per-day totals per agent, the toolkit's
// four counts and the call counts of tools on the curated public list leave
// this function; an unlisted name, a path or any other key cannot survive it.
// Needs Node 22.18+ (it imports the TypeScript schema directly).

import { USAGE_EXPORT_VERSION, usageExportSchema } from "../lib/metrics/usageSchema.ts";

const total = (c) => c.in + c.out + c.cr + c.cw;

export function buildUsageExport(snapshot, publicList, { from = "0000-00-00", generatedAt = snapshot.generated } = {}) {
  const listed = new Set(publicList.map((entry) => `${entry.group}\0${entry.name}`));
  const { customSkills, installedSkills, plugins, mcpServers } = snapshot.toolkit;
  const named = snapshot.toolkit.named
    .filter((tool) => listed.has(`${tool.group}\0${tool.name}`))
    .map(({ name, group, calls }) => ({ name, group, calls }));
  return usageExportSchema.parse({
    version: USAGE_EXPORT_VERSION,
    generatedAt,
    tz: snapshot.tz,
    days: snapshot.days.filter((day) => day.d >= from).map((day) => ({ d: day.d, claude: total(day.claude), codex: total(day.codex) })),
    toolkit: { customSkills, installedSkills, plugins, mcpServers, named },
  });
}
