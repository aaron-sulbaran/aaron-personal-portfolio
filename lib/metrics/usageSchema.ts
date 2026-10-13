import { z } from "zod";

const counts = z.object({
  in: z.number().int().nonnegative(),
  out: z.number().int().nonnegative(),
  cr: z.number().int().nonnegative(),
  cw: z.number().int().nonnegative(),
  msgs: z.number().int().nonnegative(),
}).strict();

export const usageSnapshotSchema = z.object({
  generated: z.string(),
  tz: z.string(),
  tools: z.object({
    claude: z.object({ unit: z.literal("tokens") }).strict(),
    codex: z.object({ unit: z.literal("tokens") }).strict(),
    cursor: z.object({ unit: z.literal("requests") }).strict(),
  }).strict(),
  days: z.array(z.object({
    d: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    claude: counts,
    codex: counts,
    cursor: z.object({ req: z.number().int().nonnegative() }).strict(),
  }).strict()),
}).strict();

export type UsageSnapshot = z.infer<typeof usageSnapshotSchema>;

export type UsageCount = "work" | "all" | "claude" | "codex" | "cursor";

export function dayTotal(day: UsageSnapshot["days"][number], count: UsageCount): number {
  if (count === "cursor") return day.cursor.req;
  if (count === "claude") return day.claude.in + day.claude.out;
  if (count === "codex") return day.codex.in + day.codex.out;
  const work = day.claude.in + day.claude.out + day.codex.in + day.codex.out;
  if (count === "work") return work;
  return work + day.claude.cr + day.claude.cw + day.codex.cr + day.codex.cw;
}

export function dominantTool(day: UsageSnapshot["days"][number]): "claude" | "codex" | "none" {
  const claude = day.claude.in + day.claude.out;
  const codex = day.codex.in + day.codex.out;
  if (claude === 0 && codex === 0) return "none";
  return claude >= codex ? "claude" : "codex";
}
