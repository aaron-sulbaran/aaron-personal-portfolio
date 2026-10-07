import { afterEach, describe, expect, it, vi } from "vitest";
import raw from "./data/contributions-6mo.json";

vi.mock("server-only", () => ({}));

const weeks = Array.from({ length: Math.ceil(raw.days.length / 7) }, (_, w) => ({
  contributionDays: raw.days.slice(w * 7, w * 7 + 7).map((d) => ({ date: d.date, contributionCount: d.count })),
}));
const calendar = { data: { user: { contributionsCollection: { contributionCalendar: { weeks } } } } };
const reply = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("fetchGithubSeries", () => {
  it("validates the calendar and computes the six-month window", async () => {
    const { fetchGithubSeries } = await import("./github");
    const { data, error } = await fetchGithubSeries("t", "2026-10-06", "6mo", reply(calendar));
    expect(error).toBeNull();
    expect(data).toMatchObject({ kind: "github", stale: false, total: 2501, activeDays: 94, range: { from: "2026-04-05", to: "2026-10-06" } });
    expect(data?.streak).toEqual({ days: 60, start: "2026-08-08", end: "2026-10-06" });
  });
  it("names a rejected token and a malformed reply, never throwing", async () => {
    const { fetchGithubSeries } = await import("./github");
    expect((await fetchGithubSeries("t", "2026-10-06", "6mo", reply({}, 401))).error).toMatch(/GITHUB_CONTRIB_TOKEN/);
    expect((await fetchGithubSeries("t", "2026-10-06", "6mo", reply({ data: { user: { nope: 1 } } }))).error).toMatch(/shape/);
    const down = vi.fn(async () => { throw new Error("network down"); });
    expect((await fetchGithubSeries("t", "2026-10-06", "6mo", down)).error).toBe("network down");
  });
});

describe("loadSeries", () => {
  it("serves the stale snapshot when the token is unset or empty", async () => {
    vi.stubEnv("GITHUB_CONTRIB_TOKEN", "");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const { loadSeries } = await import("./github");
    const s = await loadSeries("github", "6mo");
    expect([s.stale, s.total, s.range.to]).toEqual([true, 2501, "2026-10-06"]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
  it("serves the last good copy, stamped stale, when a later fetch fails; the snapshot when there is none", async () => {
    vi.stubEnv("GITHUB_CONTRIB_TOKEN", "t");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { loadSeries } = await import("./github");
    vi.stubGlobal("fetch", reply({}, 500));
    expect((await loadSeries("github", "6mo", new Date("2026-10-07T12:00:00Z"))).range.to).toBe("2026-10-06");
    vi.stubGlobal("fetch", reply(calendar));
    expect((await loadSeries("github", "6mo", new Date("2026-10-06T12:00:00Z"))).stale).toBe(false);
    vi.stubGlobal("fetch", reply({}, 500));
    const after = await loadSeries("github", "6mo", new Date("2026-10-07T12:00:00Z"));
    expect([after.stale, after.total]).toEqual([true, 2501]);
  });
});
