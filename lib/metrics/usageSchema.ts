import { z } from "zod";

const counts = z.object({
  in: z.number().int().nonnegative(),
  out: z.number().int().nonnegative(),
  cr: z.number().int().nonnegative(),
  cw: z.number().int().nonnegative(),
  msgs: z.number().int().nonnegative(),
}).strict();

const count = z.number().int().nonnegative();

export const TOOL_GROUPS = ["written", "used", "plugin", "mcp"] as const;
export type ToolGroup = (typeof TOOL_GROUPS)[number];

// A tool from the curated public list (lib/metrics/toolkit-public.json) with
// its call count in the window. Tools off the list are never named.
export const namedToolSchema = z.object({
  name: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  group: z.enum(TOOL_GROUPS),
  calls: count,
}).strict();

// The agent setup: four counts over the whole setup (scripts/toolkit-counts.mjs)
// and the named public tools (scripts/toolkit-calls.mjs).
export const toolkitSchema = z.object({
  customSkills: count,
  installedSkills: count,
  plugins: count,
  mcpServers: count,
  named: z.array(namedToolSchema),
}).strict();

export const usageSnapshotSchema = z.object({
  generated: z.string(),
  tz: z.string(),
  tools: z.object({
    claude: z.object({ unit: z.literal("tokens") }).strict(),
    codex: z.object({ unit: z.literal("tokens") }).strict(),
    cursor: z.object({ unit: z.literal("requests") }).strict(),
  }).strict(),
  toolkit: toolkitSchema,
  days: z.array(z.object({
    d: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    claude: counts,
    codex: counts,
    cursor: z.object({ req: z.number().int().nonnegative() }).strict(),
  }).strict()),
}).strict();

export type UsageSnapshot = z.infer<typeof usageSnapshotSchema>;
export type ToolCounts = z.infer<typeof counts>;
export type Toolkit = z.infer<typeof toolkitSchema>;
export type NamedTool = z.infer<typeof namedToolSchema>;

// A tool's total tokens for a day: input, output, cache reads and cache writes.
export const toolTotal = (c: ToolCounts): number => c.in + c.out + c.cr + c.cw;
