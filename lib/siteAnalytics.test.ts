import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Va = { va?: unknown; vaq?: unknown[][] };
const win = () => window as unknown as Va;

// The reporter is a module-level singleton with a cap, so each test gets a fresh module.
async function load() {
  vi.resetModules();
  return import("@/components/SiteAnalytics");
}

describe("site analytics", () => {
  const appended: unknown[] = [];
  const created: unknown[] = [];

  beforeEach(() => {
    appended.length = 0;
    created.length = 0;
    vi.stubGlobal("window", { location: { pathname: "/" } });
    vi.stubGlobal("document", {
      head: {
        querySelector: () => appended[0] ?? null,
        appendChild: (node: unknown) => appended.push(node),
      },
      createElement: () => {
        const node = { dataset: {} };
        created.push(node);
        return node;
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("ensureAnalytics", () => {
    it("defines window.va so track() has somewhere to queue when the layout never mounted", async () => {
      const { ensureAnalytics } = await load();
      expect(win().va).toBeUndefined();
      ensureAnalytics();
      expect(typeof win().va).toBe("function");
    });

    it("is safe to call twice: the second call finds the first call's script and adds nothing", async () => {
      const { ensureAnalytics } = await load();
      ensureAnalytics();
      expect(appended).toHaveLength(1);
      expect(() => ensureAnalytics()).not.toThrow();
      expect(appended).toHaveLength(1);
      expect(created).toHaveLength(1);
      expect(typeof win().va).toBe("function");
    });
  });

  describe("reportClientError", () => {
    it("queues the filter and then the event when it reports before <Analytics> mounted, without adding a script", async () => {
      const { reportClientError } = await load();
      expect(win().va).toBeUndefined();
      reportClientError("window", new Error("x"));
      const queue = win().vaq ?? [];
      expect(queue).toHaveLength(2);
      expect(queue[0][0]).toBe("beforeSend");
      expect(typeof queue[0][1]).toBe("function");
      expect(queue[1][0]).toBe("event");
      expect(queue[1][1]).toMatchObject({ name: "client_error", data: { where: "window", detail: "Error" } });
      expect(created).toHaveLength(0);
      expect(appended).toHaveLength(0);
    });

    it("uses the existing window.va without making a second queue", async () => {
      const spy = vi.fn();
      win().va = spy;
      const { reportClientError } = await load();
      reportClientError("window", new Error("x"));
      expect(win().va).toBe(spy);
      expect(win().vaq).toBeUndefined();
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0]).toBe("event");
      expect(spy.mock.calls[0][1]).toMatchObject({ name: "client_error", data: { where: "window", detail: "Error" } });
    });
  });
});
