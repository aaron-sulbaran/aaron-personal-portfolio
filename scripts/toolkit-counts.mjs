// The pure half of the agent setup count in scripts/usage-snapshot.mjs: how
// many skills I wrote, how many I installed, my plugins and my MCP servers.
// countToolkit returns four counts and nothing else; no name, path or setting
// leaves it. setupNames lists what exists, for scripts/toolkit-calls.mjs to check
// a public name against; it is never written to a file.
// The repo is public, so no path here is personal: the home and vault
// directories are passed in.
import { lstatSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { join, sep } from "node:path";

// Skills that sit in ~/.claude/skills as real folders but come from someone
// else's repo, so they count as installed, not written. Anything symlinked in
// from ~/.agents/skills is installed too and needs no entry here.
export const THIRD_PARTY_SKILLS = {
  names: [
    "hyperframes", // HeyGen's HyperFrames pack
    "media-use", // the same pack
    "website-to-hyperframes", // the same pack
  ],
  prefixes: [
    "hyperframes-", // the rest of the HyperFrames pack (animation, audio, cli, core and so on)
  ],
};

const isThirdParty = (name) => THIRD_PARTY_SKILLS.names.includes(name) || THIRD_PARTY_SKILLS.prefixes.some((p) => name.startsWith(p));

const entries = (dir) => {
  try {
    return readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
};

// A skill is a folder (or a link to one) holding a SKILL.md; a folder without
// one (such as `synced`) is not a skill.
const isSkill = (path) => {
  try {
    return statSync(join(path, "SKILL.md")).isFile();
  } catch {
    return false;
  }
};

const realOrNull = (path) => {
  try {
    return realpathSync(path);
  } catch {
    return null;
  }
};

const readJson = (path) => {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return {};
  }
};

// ~/.claude/skills: a link into ~/.agents and a third-party folder are
// installed; any other skill (a folder of mine, or a link to one in the vault)
// is written. Then the vault's own skills, each name counted once.
function countSkills(home, vault) {
  const agents = realOrNull(join(home, ".agents"));
  const custom = new Set();
  const installed = new Set();
  const skillsDir = join(home, ".claude", "skills");
  for (const entry of entries(skillsDir)) {
    const path = join(skillsDir, entry.name);
    if (!isSkill(path)) continue;
    const linked = lstatSync(path).isSymbolicLink();
    const target = linked ? realOrNull(path) : null;
    const fromAgents = Boolean(agents && target && (target === agents || target.startsWith(agents + sep)));
    if (fromAgents || isThirdParty(entry.name)) installed.add(entry.name);
    else custom.add(entry.name);
  }
  if (vault) {
    const vaultSkills = join(vault, ".claude", "skills");
    for (const entry of entries(vaultSkills)) if (isSkill(join(vaultSkills, entry.name))) custom.add(entry.name);
  }
  return { customSkills: custom.size, installedSkills: installed.size };
}

const installedPlugins = (home) => readJson(join(home, ".claude", "plugins", "installed_plugins.json")).plugins ?? {};

// Unique plugin names: one plugin installed from two marketplaces is one.
function pluginNames(home) {
  return new Set(Object.keys(installedPlugins(home)).map((key) => key.split("@")[0]));
}

// Unique server names across Claude Code (top level and every project) and Cursor.
function mcpServerNames(home) {
  const claude = readJson(join(home, ".claude.json"));
  const cursor = readJson(join(home, ".cursor", "mcp.json"));
  return new Set([
    ...Object.keys(claude.mcpServers ?? {}),
    ...Object.values(claude.projects ?? {}).flatMap((project) => Object.keys(project?.mcpServers ?? {})),
    ...Object.keys(cursor.mcpServers ?? {}),
  ]);
}

export function countToolkit({ home, vault }) {
  return { ...countSkills(home, vault), plugins: pluginNames(home).size, mcpServers: mcpServerNames(home).size };
}

// Every skill, command, plugin and server name that exists in the setup. It
// only answers "is this public name really installed here" for the calls
// module; it is never written out, so unlisted names stay on this machine.
export function setupNames({ home, vault }) {
  const skills = new Set();
  const addSkillDirs = (dir) => {
    for (const entry of entries(dir)) if (isSkill(join(dir, entry.name))) skills.add(entry.name);
  };
  addSkillDirs(join(home, ".claude", "skills"));
  addSkillDirs(join(home, ".agents", "skills"));
  if (vault) addSkillDirs(join(vault, ".claude", "skills"));
  for (const entry of entries(join(home, ".claude", "commands"))) {
    if (entry.isFile() && entry.name.endsWith(".md")) skills.add(entry.name.slice(0, -3));
  }
  for (const installs of Object.values(installedPlugins(home))) {
    for (const install of installs) {
      if (typeof install?.installPath === "string") addSkillDirs(join(install.installPath, "skills"));
    }
  }
  return { skills, plugins: pluginNames(home), mcp: mcpServerNames(home) };
}
