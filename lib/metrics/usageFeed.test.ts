import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import publicList from "./toolkit-public.json";
import { staleStamp } from "./format";
import type { ToolGroup, UsageExport } from "./usageSchema";

vi.mock("server-only", () => ({}));

const REPO = "example-owner/example-vault";
const NOW = new Date("2026-10-17T15:00:00.000Z");
const listed = publicList[0] as { name: string; group: ToolGroup };
const feed = (patch: Partial<UsageExport> = {}): UsageExport => ({
  version: 1,
  generatedAt: "2026-10-17T06:00:00.000Z",
  tz: "America/Chicago",
  days: [
    { d: "2026-10-15", claude: 1_000_000, codex: 500_000 },
    { d: "2026-10-16", claude: 2_000_000, codex: 0 },
  ],
  toolkit: { customSkills: 20, installedSkills: 25, plugins: 8, mcpServers: 10, named: [{ name: listed.name, group: listed.group, calls: 3 }] },
  ...patch,
});
const reply = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status }));

async function load(fetchImpl: typeof fetch) {
  const { loadUsageSeries } = await import("./usageFeed");
  return loadUsageSeries(NOW, fetchImpl);
}
const { loadUsage } = await import("./usage");
const snapshotSeries = loadUsage();

beforeEach(() => {
  vi.stubEnv("VAULT_REPO", REPO);
  vi.stubEnv("VAULT_READ_TOKEN", "token");
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.restoreAllMocks();
});

describe("loadUsageSeries", () => {
  it("reads the feed over the contents API with the token, revalidating hourly", async () => {
    const fetchImpl = reply(feed());
    const series = await load(fetchImpl as unknown as typeof fetch);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit & { next?: { revalidate: number } }];
    expect(url).toBe(`https://api.github.com/repos/${REPO}/contents/wiki/metrics/usage-export.json?ref=main`);
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer token");
    expect(init.next).toEqual({ revalidate: 3600 });
    expect(series).toMatchObject({ kind: "usage", total: 3_500_000, activeDays: 2, stale: false, updatedAt: "2026-10-17", range: { to: "2026-10-17" } });
    expect(series.toolkit.named).toEqual([{ name: listed.name, group: listed.group, calls: 3 }]);
  });

  it("falls back to the committed snapshot on each failure mode", async () => {
    const failures: Array<[string, () => typeof fetch, Record<string, string | undefined>?]> = [
      ["VAULT_REPO unset", () => reply(feed()) as unknown as typeof fetch, { VAULT_REPO: "" }],
      ["VAULT_READ_TOKEN unset", () => reply(feed()) as unknown as typeof fetch, { VAULT_READ_TOKEN: "" }],
      ["a malformed VAULT_REPO", () => reply(feed()) as unknown as typeof fetch, { VAULT_REPO: "../../etc" }],
      ["a network error", () => vi.fn(async () => { throw new Error("offline"); }) as unknown as typeof fetch],
      ["a 404", () => reply({ message: "Not Found" }, 404) as unknown as typeof fetch],
      ["a 401", () => reply({ message: "Bad credentials" }, 401) as unknown as typeof fetch],
      ["a 500", () => reply({}, 500) as unknown as typeof fetch],
      ["a bad schema", () => reply({ ...feed(), extra: "/Users/x" }) as unknown as typeof fetch],
      ["a future version", () => reply({ ...feed(), version: 2 }) as unknown as typeof fetch],
      ["a body that is not JSON", () => vi.fn(async () => new Response("not json", { status: 200 })) as unknown as typeof fetch],
    ];
    for (const [label, makeFetch, env] of failures) {
      vi.resetModules();
      for (const [key, value] of Object.entries(env ?? {})) vi.stubEnv(key, value as string);
      const series = await load(makeFetch());
      expect(series, label).toEqual(snapshotSeries);
      expect(series.stale, label).toBe(true);
      vi.stubEnv("VAULT_REPO", REPO);
      vi.stubEnv("VAULT_READ_TOKEN", "token");
    }
  });

  it("does not call the network when the env is unset", async () => {
    vi.stubEnv("VAULT_REPO", "");
    const fetchImpl = reply(feed());
    await load(fetchImpl as unknown as typeof fetch);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("serves the last good feed when a later refresh fails", async () => {
    const { loadUsageSeries } = await import("./usageFeed");
    const first = await loadUsageSeries(NOW, reply(feed()) as unknown as typeof fetch);
    const later = await loadUsageSeries(NOW, reply({}, 500) as unknown as typeof fetch);
    expect(later).toEqual(first);
  });

  it("drops a tool off the public list even if the feed names it", async () => {
    const polluted = feed({ toolkit: { ...feed().toolkit, named: [{ name: listed.name, group: listed.group, calls: 3 }, { name: "client-secret-tool", group: "written" as const, calls: 50 }] } });
    const series = await load(reply(polluted) as unknown as typeof fetch);
    expect(series.toolkit.named.map((t) => t.name)).toEqual([listed.name]);
  });
});

describe("the stale stamp", () => {
  it("uses the feed's generatedAt day, in its own tz, once the data is older than about a day", async () => {
    const old = feed({ generatedAt: "2026-10-14T02:00:00.000Z" });
    const series = await load(reply(old) as unknown as typeof fetch);
    expect(series.stale).toBe(true);
    expect(series.updatedAt).toBe("2026-10-13");
    expect(staleStamp(series)).toBe("Updated Oct 13");
  });

  it("shows nothing while the feed is fresh, and for the snapshot falls back to its last day", async () => {
    const fresh = await load(reply(feed({ generatedAt: "2026-10-16T20:00:00.000Z" })) as unknown as typeof fetch);
    expect(fresh.stale).toBe(false);
    expect(staleStamp(fresh)).toBeNull();
    expect(snapshotSeries.updatedAt).toBeUndefined();
    expect(staleStamp(snapshotSeries)).toMatch(/^Updated [A-Z][a-z]{2} \d{1,2}$/);
  });
});
