// The tool groups, in display order. Kept free of any zod import so client
// components can read them without pulling the schema library into the bundle.
export const TOOL_GROUPS = ["written", "used", "plugin", "mcp"] as const;
export type ToolGroup = (typeof TOOL_GROUPS)[number];
