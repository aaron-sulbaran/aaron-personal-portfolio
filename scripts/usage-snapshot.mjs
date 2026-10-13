// Reads local Claude and Codex logs and writes daily integer totals only.
// Nothing else leaves the laptop: no prompts, paths, ids, or model names.
// Run: node scripts/usage-snapshot.mjs --since 2026-04-01 --out lib/metrics/data/usage-6mo.json
//
// Claude counts the way Claude Code's desktop app counts its "Total tokens":
// every assistant line in ~/.claude/projects, subagent transcripts included.
// Claude Code writes one line per content block of a response (thinking, text,
// each tool call), each repeating the response's usage, so this sums a response
// once per block. Pass --claude responses to count each API response once
// (by message id and request id), which is about 2.3 times smaller.
// Codex: input_tokens already includes cached_input_tokens and output_tokens
// already includes reasoning, so `in` is the uncached part and the four fields
// sum to Codex's own total_tokens.
//
// It also writes `toolkit`, the agent setup's four counts (scripts/toolkit-counts.mjs):
// counts only, never a name. The vault's skills are read from --vault <dir>,
// else VAULT_DEV_PATH (from the environment or .env.local); with neither the
// vault is skipped, with a warning.

import { createReadStream, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseEnv } from "node:util";
import { countToolkit } from "./toolkit-counts.mjs";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const since = flag("--since", "2026-04-01");
const outPath = flag("--out", "lib/metrics/data/usage-6mo.json");
const claudeRule = flag("--claude", "app");
if (claudeRule !== "app" && claudeRule !== "responses") {
  throw new Error(`--claude must be "app" or "responses", got ${claudeRule}`);
}

function envLocal(name) {
  try {
    return parseEnv(readFileSync(".env.local", "utf8"))[name];
  } catch {
    return undefined;
  }
}
const vault = flag("--vault", process.env.VAULT_DEV_PATH || envLocal("VAULT_DEV_PATH"));

function localDay(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function blank() {
  return { in: 0, out: 0, cr: 0, cw: 0, msgs: 0 };
}

function walk(dir, acc) {
  let entries = [];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, acc);
    else if (entry.isFile() && entry.name.endsWith(".jsonl")) acc.push(path);
  }
}

async function readLines(path, onLine) {
  const stream = createReadStream(path, { encoding: "utf8" });
  const lines = createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line) continue;
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      continue;
    }
    onLine(row);
  }
}

const claudeLines = [];
const claudeResponses = new Map();

function claudeCounts(usage) {
  return {
    in: usage.input_tokens ?? 0,
    out: usage.output_tokens ?? 0,
    cr: usage.cache_read_input_tokens ?? 0,
    cw: usage.cache_creation_input_tokens ?? 0,
  };
}

async function scanClaude(root) {
  const files = [];
  walk(root, files);
  for (const path of files) {
    await readLines(path, (row) => {
      if (row.type !== "assistant" || !row.message?.usage) return;
      const day = localDay(row.timestamp);
      if (!day || day < since) return;
      const counts = claudeCounts(row.message.usage);
      claudeLines.push({ day, ...counts });
      if (!row.message.id) return;
      const key = `${row.message.id}\0${row.requestId ?? ""}`;
      const prev = claudeResponses.get(key) ?? { day, in: 0, out: 0, cr: 0, cw: 0 };
      prev.day = day;
      prev.in = Math.max(prev.in, counts.in);
      prev.out = Math.max(prev.out, counts.out);
      prev.cr = Math.max(prev.cr, counts.cr);
      prev.cw = Math.max(prev.cw, counts.cw);
      claudeResponses.set(key, prev);
    });
  }
  return files.length;
}

async function scanCodex(root) {
  const files = [];
  walk(root, files);
  const days = new Map();
  for (const path of files) {
    let total = 0;
    await readLines(path, (row) => {
      const payload = row.payload ?? row;
      if (payload?.type !== "token_count") return;
      const next = payload.info?.total_token_usage?.total_tokens;
      if (typeof next !== "number" || next <= total) return;
      const day = localDay(row.timestamp);
      total = next;
      if (!day || day < since) return;
      const last = payload.info?.last_token_usage ?? {};
      const cached = last.cached_input_tokens ?? 0;
      const written = last.cache_write_input_tokens ?? 0;
      const bucket = days.get(day) ?? blank();
      bucket.in += Math.max(0, (last.input_tokens ?? 0) - cached - written);
      bucket.out += last.output_tokens ?? 0;
      bucket.cr += cached;
      bucket.cw += written;
      bucket.msgs += 1;
      days.set(day, bucket);
    });
  }
  return { files: files.length, days };
}

function add(map, day, tool, patch) {
  const row = map.get(day) ?? { claude: blank(), codex: blank(), cursor: { req: 0 } };
  const target = row[tool];
  for (const key of Object.keys(patch)) target[key] += patch[key];
  map.set(day, row);
}

const home = homedir();
const claudeFiles = await scanClaude(join(home, ".claude", "projects"));
const codex = await scanCodex(join(home, ".codex", "sessions"));
const days = new Map();
const claudeRows = claudeRule === "app" ? claudeLines : [...claudeResponses.values()];
for (const turn of claudeRows) {
  add(days, turn.day, "claude", { in: turn.in, out: turn.out, cr: turn.cr, cw: turn.cw, msgs: 0 });
}
for (const turn of claudeResponses.values()) add(days, turn.day, "claude", { msgs: 1 });
for (const [day, bucket] of codex.days) add(days, day, "codex", bucket);

const snapshot = {
  generated: new Date().toISOString(),
  tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
  tools: {
    claude: { unit: "tokens" },
    codex: { unit: "tokens" },
    cursor: { unit: "requests" },
  },
  toolkit: countToolkit({ home, vault }),
  days: [...days.keys()].sort().map((d) => ({ d, ...days.get(d) })),
};

const sum = (tool) => snapshot.days.reduce((acc, day) => {
  const c = day[tool];
  return acc + c.in + c.out + c.cr + c.cw;
}, 0);
const billions = (n) => `${(n / 1e9).toFixed(2)}B`;
writeFileSync(outPath, `${JSON.stringify(snapshot, null, 2)}\n`);
console.error(`claude files ${claudeFiles}, lines ${claudeLines.length}, responses ${claudeResponses.size}, rule ${claudeRule}`);
console.error(`codex files ${codex.files}, days ${snapshot.days.length}`);
console.error(`claude ${billions(sum("claude"))}, codex ${billions(sum("codex"))}`);
console.error("cursor request log not found; req stays 0");
const kit = snapshot.toolkit;
console.error(`toolkit: ${kit.customSkills} custom skills, ${kit.installedSkills} installed skills, ${kit.plugins} plugins, ${kit.mcpServers} MCP servers`);
if (!vault) console.error("warning: no --vault and VAULT_DEV_PATH is unset; the vault's skills are not counted");
