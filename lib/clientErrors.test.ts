import { describe, expect, it, vi } from "vitest";
import {
  CLIENT_ERROR_EVENT,
  MAX_ERROR_REPORTS,
  createClientErrorReporter,
  errorDetail,
  windowErrorValue,
} from "./clientErrors";

describe("errorDetail", () => {
  it("names the error and its message, with no stack", () => {
    const error = new TypeError("x is not a function");
    error.stack = "TypeError: x is not a function\n    at secret (/app/chunk.js:1:2)";
    expect(errorDetail(error)).toBe("TypeError: x is not a function");
  });

  it("cuts the message to 120 characters", () => {
    const detail = errorDetail(new Error("a".repeat(500)));
    expect(detail).toBe(`Error: ${"a".repeat(120)}`);
  });

  it("adds the Next digest when there is one", () => {
    const error = Object.assign(new Error("boom"), { digest: "1234567890" });
    expect(errorDetail(error)).toBe("Error: boom (digest 1234567890)");
  });

  it("drops the query string and fragment from any URL in the message", () => {
    const detail = errorDetail(new Error("Failed to fetch https://example.com/api/x?token=abc&b=2#frag now"));
    expect(detail).toBe("Error: Failed to fetch https://example.com/api/x now");
    expect(detail).not.toContain("token");
  });

  it("drops the query string and fragment from a relative path in the message", () => {
    const detail = errorDetail(new Error("Failed to load /some/path?key=abc#x now"));
    expect(detail).toBe("Error: Failed to load /some/path now");
    expect(detail).not.toContain("key");
  });

  it("leaves ordinary prose with a question mark alone", () => {
    expect(errorDetail(new Error("Why did this fail? Unknown"))).toBe("Error: Why did this fail? Unknown");
  });

  it("describes a thrown string, an object and nothing", () => {
    expect(errorDetail("plain text")).toBe("Thrown: plain text");
    expect(errorDetail({ message: "from an object", digest: "d1" })).toBe("Error: from an object (digest d1)");
    expect(errorDetail(undefined)).toBe("Thrown: unknown");
    expect(errorDetail(42)).toBe("Thrown: unknown");
  });
});

describe("windowErrorValue", () => {
  it("passes the error object through", () => {
    const error = new Error("real");
    expect(windowErrorValue({ error, message: "Uncaught Error: real" })).toBe(error);
  });

  it("ignores a cross-origin Script error with no error object", () => {
    expect(windowErrorValue({ error: null, message: "Script error." })).toBeNull();
    expect(windowErrorValue({ error: undefined, message: "" })).toBeNull();
  });

  it("keeps a message-only event that says something", () => {
    expect(windowErrorValue({ error: null, message: "Unexpected token '<'" })).toBe("Unexpected token '<'");
  });

  it("drops the benign ResizeObserver notices when they carry no error object", () => {
    expect(windowErrorValue({ error: null, message: "ResizeObserver loop completed with undelivered notifications." })).toBeNull();
    expect(windowErrorValue({ error: null, message: "ResizeObserver loop limit exceeded" })).toBeNull();
  });

  it("keeps a ResizeObserver error that carries a real error object", () => {
    const error = new Error("ResizeObserver loop failed");
    expect(windowErrorValue({ error, message: error.message })).toBe(error);
  });
});

function reporter(overrides: Partial<Parameters<typeof createClientErrorReporter>[0]> = {}) {
  const send = vi.fn();
  const report = createClientErrorReporter({ send, pathname: () => "/", isPrivate: () => false, ...overrides });
  return { send, report };
}

describe("createClientErrorReporter", () => {
  it("sends one client_error event with exactly where and detail", () => {
    const { send, report } = reporter();
    report("error-page", new Error("boom"));
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(CLIENT_ERROR_EVENT, { where: "error-page", detail: "Error: boom" });
    expect(CLIENT_ERROR_EVENT).toBe("client_error");
  });

  it("sends nothing from a private path, and does not spend the budget on it", () => {
    let path = "/private/area";
    const { send, report } = reporter({ pathname: () => path, isPrivate: (p) => p.startsWith("/private") });
    report("window", new Error("hidden"));
    expect(send).not.toHaveBeenCalled();
    path = "/";
    report("window", new Error("hidden"));
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("sends an identical detail once", () => {
    const { send, report } = reporter();
    report("window", new Error("same"));
    report("error-page", new Error("same"));
    report("window", new Error("different"));
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("stops after three reports a page load", () => {
    const { send, report } = reporter();
    for (let i = 0; i < 10; i += 1) report("window", new Error(`e${i}`));
    expect(MAX_ERROR_REPORTS).toBe(3);
    expect(send).toHaveBeenCalledTimes(3);
  });

  it("never throws, even when the sender does", () => {
    const { report } = reporter({
      send: () => {
        throw new Error("analytics blocked");
      },
    });
    expect(() => report("window", new Error("boom"))).not.toThrow();
  });
});
