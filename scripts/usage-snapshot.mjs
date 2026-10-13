// Reads local Claude and Codex logs and writes daily integer totals only.
// Nothing else leaves the laptop: no prompts, paths, ids, or model names.
// Run: node scripts/usage-snapshot.mjs --since 2026-04-01 --out lib/metrics/data/usage-6mo.json

import { createReadStream, readdirSync, statSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { homedir } from "node:os";
import { join } from "node:path";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const since = flag("--since", "2026-04-01");
const outPath = flag("--out", "lib/metrics/data/usage-6mo.json");

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

const claudeKeys = new Map();

async function scanClaude(root) {
  const files = [];
  walk(root, files);
  for (const path of files) {
    await readLines(path, (row) => {
      if (row.type !== "assistant" || !row.message?.usage || !row.message.id) return;
      const day = localDay(row.timestamp);
      if (!day || day < since) return;
      const usage = row.message.usage;
      const key = `${row.message.id}\0${row.requestId ?? ""}`;
      const prev = claudeKeys.get(key) ?? { day, in: 0, out: 0, cr: 0, cw: 0 };
      prev.day = day;
      prev.in = Math.max(prev.in, usage.input_tokens ?? 0);
      prev.out = Math.max(prev.out, usage.output_tokens ?? 0);
      prev.cr = Math.max(prev.cr, usage.cache_read_input_tokens ?? 0);
      prev.cw = Math.max(prev.cw, usage.cache_creation_input_tokens ?? 0);
      claudeKeys.set(key, prev);
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
      const bucket = days.get(day) ?? blank();
      bucket.in += last.input_tokens ?? 0;
      bucket.out += (last.output_tokens ?? 0) + (last.reasoning_output_tokens ?? 0);
      bucket.cr += last.cached_input_tokens ?? 0;
      bucket.cw += last.cache_write_input_tokens ?? 0;
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
for (const turn of claudeKeys.values()) {
  add(days, turn.day, "claude", { in: turn.in, out: turn.out, cr: turn.cr, cw: turn.cw, msgs: 1 });
}
for (const [day, bucket] of codex.days) add(days, day, "codex", bucket);

const snapshot = {
  generated: new Date().toISOString(),
  tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
  tools: {
    claude: { unit: "tokens" },
    codex: { unit: "tokens" },
    cursor: { unit: "requests" },
  },
  days: [...days.keys()].sort().map((d) => ({ d, ...days.get(d) })),
};

writeFileSync(outPath, `${JSON.stringify(snapshot, null, 2)}\n`);
console.error(`claude files ${claudeFiles}, turns ${claudeKeys.size}, codex files ${codex.files}, days ${snapshot.days.length}`);
console.error("cursor request log not found; req stays 0");
