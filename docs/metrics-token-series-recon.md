# The AI token series: where the data lives

Recon for the second metrics series Aaron asked for on 2026-10-06: the contribution skyline with a toggle between GitHub contributions and AI token usage per day, stacked by tool. Not in the first public edition. The metrics slice shapes its data door (`loadSeries`) so this plugs in later. Read-only findings from a Sonnet recon agent, checked by Fable; nothing here is built.

## Where the numbers come from

**Vorssaint** (github.com/vorssaint/vorssaint-utils, GPL-3.0, a Swift menu-bar app) reads the agents' own local logs; there is no API:

| Tool | Files read | Usage record | Dedupe |
|---|---|---|---|
| Claude Code | `~/.claude/projects/**/*.jsonl` (and `~/.config/claude/projects`) | lines with `type: "assistant"`, `message.usage` (`input_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`, `output_tokens`, thinking tokens, the 1h cache breakdown), `message.model`, top-level `timestamp` | key `message.id` + `requestId`; streamed replies repeat per content block, merged by per-field max; subagent transcripts counted too |
| Codex | `~/.codex/sessions/YYYY/MM/DD/*.jsonl` and `archived_sessions` | `event_msg` with `payload.type: "token_count"`, `total_token_usage` and `last_token_usage` | a record only when the running total grows |
| OpenCode, Copilot | `~/.local/share/opencode`, `~/.copilot/session-state` | not relevant here | |
| Cursor | not supported | | |

Daily totals are 91 local-day buckets with per-provider sums (`AgentUsageSummary.swift`); cost is a shipped price table (`agent-prices.json`) refreshed from the repo. Its "37B tokens" style figure includes cache reads, which dominate.

**On this machine (2026-10-06):** `~/.claude/projects` holds 46 project folders and 4,411 transcripts, 4.7 GB (1,813 under `subagents/`). `~/.claude/stats-cache.json` has the right shape (daily activity, daily tokens by model, per-model usage) but is stale since February and cannot be relied on. `~/.codex/sessions` holds 251 files, 182 MB. Dedupe matters: across the 60 newest Claude transcripts, 6,448 usage lines collapse to 2,888 unique keys, a 2.2x overcount if summed raw. Cursor keeps no local token counts; its `ai-tracking/ai-code-tracking.db` records code attribution per request (hash, file, request id, model, timestamp), so the honest Cursor series is "requests per day", labelled as such, never "tokens".

The installed `explain-usage` skill reads only the current session's transcript and weights cache reads 0.1x, cache writes 2x and output 5x a plain input token; the weighting idea is reusable, the code is not.

## The pipeline, when it is built

1. **A local script** (`scripts/usage-snapshot.mjs`, stdlib only, read-only) walks the Claude and Codex logs, dedupes as above, buckets by local day, and writes per day per tool: input, output, cache read, cache write, message count (Claude and Codex), requests (Cursor). File-mtime and byte-offset cursors make incremental runs take seconds; a full scan a few minutes.
2. **Output shape**, about 100 KB a year: `{ generated, tz, tools: { claude: { unit: "tokens" }, codex: { unit: "tokens" }, cursor: { unit: "requests" } }, days: [{ d, claude: { in, out, cr, cw, msgs }, codex, cursor: { req } }] }`. Validated with zod on both ends; any extra string field rejects the file.
3. **Delivery.** Start by committing the snapshot by hand (zero infrastructure; the repo is public, so the file is a public record of working days). Then mirror the recruiting pattern: the script writes into the private vault repo, and a server-only `lib/usage/data.ts` copies `lib/recruiting/data.ts` (GitHub contents API, a read-only token, ISR, a last-good fallback, a generic unavailable state since this surface is public, never an error string). A launchd job or the Talos cron runs the script and pushes. This is the backend growth: one scheduled local job and one more read of the vault repo.
4. **The skyline** takes a second series through `loadSeries("usage", window)`; a stacked day maps to the cell's height by total and to its colour by the dominant tool, or the toggle shows one tool at a time. The Coil's one-accent rule holds: tools are told apart by step, not by a second hue, unless Aaron rules otherwise in a lab.

## The privacy line

Leaves the laptop: per-day integer counts per tool, nothing else. Never: transcripts, prompts or responses, `history.jsonl`, file paths and `cwd`, project, repo or branch names, session and request ids, model strings beyond a family bucket, `auth.json`, `~/.claude.json`, Cursor database contents, timestamps finer than a day, and cost, plan or account details unless Aaron opts in. A daily pattern still reveals when he works; bucketing counts into the heat map's steps in the public file leaks less than raw totals.
