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
    const detail = errorDetail(new Error("word ".repeat(100)));
    expect(detail).toBe(`Error: ${"word ".repeat(100).slice(0, 120)}`);
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

  it.each([
    ["a dot-relative path", "Failed ./private/open?key=SECRET now", "Error: Failed ./private/open now"],
    ["a bracketed path", "Failed [/private/open?key=SECRET] now", "Error: Failed [/private/open now"],
    ["an uppercase scheme", "Failed HTTPS://example.com/?key=SECRET now", "Error: Failed HTTPS://example.com/ now"],
    ["a bare query at the start", "?key=SECRET", "Error: "],
    ["a bare fragment at the start", "#PRIVATE", "Error: "],
  ])("drops the secret from %s", (_label, message, expected) => {
    const detail = errorDetail(new Error(message));
    expect(detail).toBe(expected);
    expect(detail).not.toContain("SECRET");
    expect(detail).not.toContain("PRIVATE");
  });

  it("accepts only identifier-like names and short token-like digests", () => {
    const named = (name: unknown, digest?: unknown) => errorDetail({ message: "boom", name, digest });
    expect(named("n".repeat(40))).toBe(`${"n".repeat(40)}: boom`);
    expect(named("n".repeat(41))).toBe("Error: boom");
    expect(named("Odd/path?key=SECRET")).toBe("Error: boom");
    expect(named("TypeError", "d".repeat(32))).toBe(`TypeError: boom (digest ${"d".repeat(32)})`);
    expect(named("TypeError", "d".repeat(33))).toBe("TypeError: boom");
    expect(named("TypeError", "abc?key=SECRET")).toBe("TypeError: boom");
    expect(named(42, 7)).toBe("Error: boom");
  });

  it("keeps a hash-numbered React error and prose with a question mark", () => {
    expect(errorDetail(new Error("React error #418"))).toBe("Error: React error #418");
  });

  it("leaves ordinary prose with a question mark alone", () => {
    expect(errorDetail(new Error("Why did this fail? Unknown"))).toBe("Error: Why did this fail? Unknown");
  });

  it("names only the type of a value that is not error-like", () => {
    expect(errorDetail("plain text")).toBe("Thrown: string");
    expect(errorDetail(42)).toBe("Thrown: number");
    expect(errorDetail({ message: 5, digest: "d1" })).toBe("Thrown: object");
    expect(errorDetail({ message: "from an object", digest: "d1" })).toBe("Error: from an object (digest d1)");
    expect(errorDetail(undefined)).toBe("Thrown: unknown");
    expect(errorDetail(null)).toBe("Thrown: unknown");
    expect(errorDetail(true)).toBe("Thrown: unknown");
  });

  // One battery of hostile inputs. Add a row for every new leak a review finds.
  const prefixed = (name: string, message: string, digest?: string) => ({ name, message, digest });
  it.each([
    ["a thrown string with an email and key", "email=alice@example.com key=SECRET", "Thrown: string", []],
    ["an email in a message", new Error("contact alice@example.com now"), "Error: contact <email> now", ["alice", "example.com"]],
    ["a local macOS path", new Error("at f (/Users/x/private.txt:1:2)"), "Error: at f (<path>", ["private.txt"]],
    ["a local linux path", new Error("open /home/bob/notes/a.txt failed"), "Error: open <path> failed", ["bob"]],
    ["a local windows path", new Error("open C:\\Users\\Carol\\a.txt failed"), "Error: open <path> failed", ["Carol"]],
    ["a bare question-mark query", new Error("Bad request ?key=SECRET"), "Error: Bad request ?key=<v>", ["SECRET"]],
    ["a key=value pair", new Error("retry with token=abc123 please"), "Error: retry with token=<v> please", ["abc123"]],
    ["an ampersand pair", new Error("sent a=1&b=SECRET2 twice"), "Error: sent a=<v>&b=<v> twice", ["SECRET2"]],
    ["a 40 character opaque token", new Error(`bad id ${"Ab1_".repeat(10)} here`), "Error: bad id <token> here", ["Ab1_"]],
    ["a url with a query", new Error("Failed https://example.com/a?token=SECRET now"), "Error: Failed https://example.com/a now", ["SECRET"]],
    ["a hostile name and digest", prefixed("?key=SECRET", "boom", "#PRIVATE"), "Error: boom", ["SECRET", "PRIVATE"]],
    ["a window error as an error-like", { name: "WindowError", message: "Unexpected token '<'" }, "WindowError: Unexpected token '<'", []],
    ["an unmasked prose message", new Error("x is not a function"), "Error: x is not a function", []],
    ["a property read", new Error("Cannot read properties of undefined (reading 'map')"), "Error: Cannot read properties of undefined (reading 'map')", []],
    ["prose with a question mark", new Error("Why did this fail? Unknown"), "Error: Why did this fail? Unknown", []],
    ["a minified react error", new Error("Minified React error #418"), "Error: Minified React error #418", []],
  ])("masks %s", (_label, value, expected, forbidden) => {
    const detail = errorDetail(value);
    expect(detail).toBe(expected);
    for (const word of forbidden as string[]) expect(detail).not.toContain(word);
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
    expect(windowErrorValue({ error: null, message: "Unexpected token '<'" })).toEqual({ name: "WindowError", message: "Unexpected token '<'" });
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
