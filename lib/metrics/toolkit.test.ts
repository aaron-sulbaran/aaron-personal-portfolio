import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { countToolkit, setupNames, THIRD_PARTY_SKILLS } from "../../scripts/toolkit-counts.mjs";
import snapshot from "./data/usage-6mo.json";
import { toolkitTotal } from "./format";
import { toolkitSchema } from "./usageSchema";

// A home and a vault on disk, laid out as mine are, with every rule's edge.
const root = mkdtempSync(join(tmpdir(), "toolkit-"));
const home = join(root, "home");
const vault = join(root, "vault");
const skill = (dir: string, name: string, withSkill = true) => {
  mkdirSync(join(dir, name), { recursive: true });
  if (withSkill) writeFileSync(join(dir, name, "SKILL.md"), "# skill\n");
};
const json = (path: string, value: unknown) => {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, JSON.stringify(value));
};

const skills = join(home, ".claude", "skills");
const agents = join(home, ".agents", "skills");
const vaultSkills = join(vault, ".claude", "skills");
for (const name of ["mine-a", "mine-b"]) skill(skills, name);
skill(skills, "synced", false);
for (const name of ["hyperframes", "hyperframes-cli", "hyperframes-core", "media-use"]) skill(skills, name);
for (const name of ["gsap-core", "chrome-extensions", "website-to-hyperframes"]) {
  skill(agents, name);
  symlinkSync(join(agents, name), join(skills, name));
}
skill(agents, "never-linked");
for (const name of ["ask", "ingest", "talos-feedback"]) skill(vaultSkills, name);
symlinkSync(join(vaultSkills, "talos-feedback"), join(skills, "talos-feedback"));
symlinkSync(join(root, "gone"), join(skills, "broken-link"));
json(join(home, ".claude", "plugins", "installed_plugins.json"), {
  version: 2,
  plugins: { "superpowers@official": [{}], "vercel@official": [{}], "market@uploads": [{}], "market@market": [{}] },
});
json(join(home, ".claude.json"), {
  mcpServers: { context7: {}, granola: {} },
  projects: { a: { mcpServers: { mobbin: {}, granola: {} } }, b: {}, c: { mcpServers: {} } },
});
json(join(home, ".cursor", "mcp.json"), { mcpServers: { context7: {}, supabase: {} } });

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe("the agent setup count", () => {
  it("counts my skills and the vault's once each, and an installed skill as installed", () => {
    expect(countToolkit({ home, vault })).toEqual({ customSkills: 5, installedSkills: 7, plugins: 3, mcpServers: 4 });
  });

  it("counts a vault skill linked into ~/.claude/skills once, and skips the vault when none is given", () => {
    expect(countToolkit({ home, vault: undefined }).customSkills).toBe(3);
  });

  it("finds nothing in an empty home, rather than failing", () => {
    expect(countToolkit({ home: join(root, "nobody"), vault: join(root, "nowhere") })).toEqual({ customSkills: 0, installedSkills: 0, plugins: 0, mcpServers: 0 });
  });

  it("keeps the third-party list explicit: the HyperFrames pack", () => {
    expect(THIRD_PARTY_SKILLS).toEqual({ names: ["hyperframes", "media-use", "website-to-hyperframes"], prefixes: ["hyperframes-"] });
  });

  it("lists what exists in the setup, for the public-name check", () => {
    const names = setupNames({ home, vault });
    expect([...names.skills].sort()).toEqual(expect.arrayContaining(["ask", "mine-a", "gsap-core", "never-linked", "talos-feedback", "hyperframes-cli"]));
    expect(names.skills.has("synced")).toBe(false);
    expect([...names.plugins].sort()).toEqual(["market", "superpowers", "vercel"]);
    expect([...names.mcp].sort()).toEqual(["context7", "granola", "mobbin", "supabase"]);
  });

  it("finds a command file and a plugin's own skills among what exists", () => {
    mkdirSync(join(home, ".claude", "commands"), { recursive: true });
    writeFileSync(join(home, ".claude", "commands", "sweeper.md"), "# command\n");
    const installPath = join(root, "plugin-cache", "superpowers");
    skill(join(installPath, "skills"), "brainstorming");
    json(join(home, ".claude", "plugins", "installed_plugins.json"), { version: 2, plugins: { "superpowers@official": [{ installPath }] } });
    const names = setupNames({ home, vault });
    expect(names.skills.has("sweeper")).toBe(true);
    expect(names.skills.has("brainstorming")).toBe(true);
  });

  it("commits the four counts and the named public tools, nothing else", () => {
    const toolkit = toolkitSchema.parse(snapshot.toolkit);
    expect(Object.keys(toolkit).sort()).toEqual(["customSkills", "installedSkills", "mcpServers", "named", "plugins"]);
    expect(toolkitTotal(toolkit)).toBe(toolkit.customSkills + toolkit.installedSkills + toolkit.plugins + toolkit.mcpServers);
    expect(toolkitSchema.safeParse({ ...toolkit, names: ["ask"] }).success).toBe(false);
  });
});
