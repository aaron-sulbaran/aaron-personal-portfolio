import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { TOOL_GROUPS as clientGroups } from "./toolGroups";
import { TOOL_GROUPS as schemaGroups } from "./usageSchema";

// scripts/usage-export.mjs and scripts/usage-snapshot.mjs load these files under
// plain Node, which strips the types but resolves imports as written: a relative
// import with no extension fails there (ERR_MODULE_NOT_FOUND), though the bundler
// and tsc accept it. Talos's daily usage export broke that way on 2026-11-07.
const SCRIPT_MODULES = ["lib/metrics/usageSchema.ts", "lib/metrics/window.ts"];

describe("the modules the usage scripts load under plain Node", () => {
  for (const file of SCRIPT_MODULES) {
    it(`${file} loads with no bundler`, () => {
      const run = () => execFileSync(process.execPath, ["--input-type=module", "-e", `await import("./${file}")`], { cwd: process.cwd(), stdio: "pipe" });
      expect(run).not.toThrow();
    });
  }

  it("the schema's tool groups are the client's, in the same order", () => {
    expect(schemaGroups).toEqual(clientGroups);
  });
});
