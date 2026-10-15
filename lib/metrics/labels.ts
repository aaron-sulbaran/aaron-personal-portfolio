import { siteContent } from "@/lib/content";

// The words the strip's figures, its toolkit band and its stale stamp wear.
// The metrics lab edits every one of them; the site reads the defaults, which
// are the approved copy in lib/content.ts. One flat record so the lab's text
// fields, its saved settings and its Copy values all share one shape.
export const LABEL_KEYS = [
  "commitsStreak",
  "commitsTotal",
  "commitsActive",
  "tokensTotal",
  "tokensActive",
  "tokensPeak",
  "toolkitTitle",
  "groupWritten",
  "groupUsed",
  "groupPlugin",
  "groupMcp",
  "updated",
] as const;

export type LabelKey = (typeof LABEL_KEYS)[number];
export type MetricsLabels = Record<LabelKey, string>;

const { metrics } = siteContent;

export const DEFAULT_LABELS: MetricsLabels = {
  commitsStreak: metrics.streakLabel,
  commitsTotal: metrics.totalLabel,
  commitsActive: metrics.activeLabel,
  tokensTotal: metrics.tokens.totalLabel,
  tokensActive: metrics.tokens.activeLabel,
  tokensPeak: metrics.tokens.peakLabel,
  toolkitTitle: metrics.tokens.toolkitLabel,
  groupWritten: metrics.tokens.groups.written,
  groupUsed: metrics.tokens.groups.used,
  groupPlugin: metrics.tokens.groups.plugin,
  groupMcp: metrics.tokens.groups.mcp,
  updated: metrics.updated,
};

// The panel's names for the fields, in the order the strip reads.
export const LABEL_NAMES: Record<LabelKey, string> = {
  commitsStreak: "Commits: streak",
  commitsTotal: "Commits: total",
  commitsActive: "Commits: active days",
  tokensTotal: "Tokens: total",
  tokensActive: "Tokens: active days",
  tokensPeak: "Tokens: biggest day",
  toolkitTitle: "Toolkit band title",
  groupWritten: "Group: written",
  groupUsed: "Group: used",
  groupPlugin: "Group: plugins",
  groupMcp: "Group: MCP servers",
  updated: "Stale stamp",
};

export const GROUP_LABEL_KEYS = { written: "groupWritten", used: "groupUsed", plugin: "groupPlugin", mcp: "groupMcp" } as const;
