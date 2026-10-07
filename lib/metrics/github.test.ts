import { afterEach, describe, expect, it, vi } from "vitest";
import raw from "./data/contributions-6mo.json";

vi.mock("server-only", () => ({}));

type Day = { date: string; count: number };
const calendarOf = (days: Day[]) => {
  const weeks = Array.from({ length: Math.ceil(days.length / 7) }, (_, w) => ({
    contributionDays: days.slice(w * 7, w * 7 + 7).map((d) => ({ date: d.date, contributionCount: d.count })),
  }));
  return { data: { user: { contributionsCollection: { contributionCalendar: { weeks } } } } };
};
const calendar = calendarOf(raw.days);
// One day past the snapshot, so a copy fetched from it differs from the snapshot in total and range.
const dayAfter = calendarOf([...raw.days, { date: "2026-10-07", count: 5 }]);
const reply = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
  vi.restoreAllMocks();
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
  it("gives up after 8 seconds, as an error, never a hang", async () => {
    const { fetchGithubSeries } = await import("./github");
    const clock = new AbortController();
    const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(clock.signal);
    const hang = vi.fn(
      (_url: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal?.reason))),
    );
    const pending = fetchGithubSeries("t", "2026-10-06", "6mo", hang as unknown as typeof fetch);
    clock.abort(new DOMException("The operation was aborted due to timeout", "TimeoutError"));
    const { data, error } = await pending;
    expect(timeout).toHaveBeenCalledWith(8000);
    expect(hang.mock.calls[0][1]?.signal).toBe(clock.signal);
    expect(data).toBeNull();
    expect(error).toMatch(/8 seconds/);
  });
  it("reports GitHub's own error message, a rate limit or a missing scope, over the shape", async () => {
    const { fetchGithubSeries } = await import("./github");
    const limited = reply({ errors: [{ type: "RATE_LIMITED", message: "API rate limit exceeded for user ID 1." }] });
    expect((await fetchGithubSeries("t", "2026-10-06", "6mo", limited)).error).toBe("GitHub GraphQL: API rate limit exceeded for user ID 1.");
    const scoped = reply({ data: null, errors: [{ message: "Your token has not been granted the required scopes." }, { message: "Second." }] });
    expect((await fetchGithubSeries("t", "2026-10-06", "6mo", scoped)).error).toBe("GitHub GraphQL: Your token has not been granted the required scopes. Second.");
    const refused = reply({ message: "API rate limit exceeded", documentation_url: "https://docs.github.com" }, 403);
    expect((await fetchGithubSeries("t", "2026-10-06", "6mo", refused)).error).toMatch(/rate limit/);
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
    vi.stubGlobal("fetch", reply(dayAfter));
    const fresh = await loadSeries("github", "6mo", new Date("2026-10-07T12:00:00Z"));
    expect([fresh.stale, fresh.total, fresh.range.to]).toEqual([false, 2506, "2026-10-07"]);
    vi.stubGlobal("fetch", reply({}, 500));
    const after = await loadSeries("github", "6mo", new Date("2026-10-08T12:00:00Z"));
    expect(after).toEqual({ ...fresh, stale: true });
  });
  it("serves the snapshot, not a good copy of another window, when a fetch fails", async () => {
    vi.stubEnv("GITHUB_CONTRIB_TOKEN", "t");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { loadSeries } = await import("./github");
    vi.stubGlobal("fetch", reply(dayAfter));
    expect((await loadSeries("github", "6mo", new Date("2026-10-07T12:00:00Z"))).total).toBe(2506);
    vi.stubGlobal("fetch", reply({}, 500));
    const other = await loadSeries("github", "12mo", new Date("2026-10-08T12:00:00Z"));
    expect([other.stale, other.window, other.total, other.range.to]).toEqual([true, "6mo", 2501, "2026-10-06"]);
  });
});
