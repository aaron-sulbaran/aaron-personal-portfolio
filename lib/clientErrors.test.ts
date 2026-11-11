import { describe, expect, it, vi } from "vitest";
import {
  CLIENT_ERROR_EVENT,
  type ErrorWhere,
  MAX_ERROR_REPORTS,
  createClientErrorReporter,
  errorDetail,
  windowErrorValue,
} from "./clientErrors";

describe("errorDetail", () => {
  const named = (name: unknown, digest?: unknown) => ({ message: "marker words here", name, digest });
  it.each([
    ["a plain Error", new Error("marker words here"), "Error"],
    ["a TypeError", new TypeError("marker words here"), "TypeError"],
    ["a custom valid name", named("WindowError"), "WindowError"],
    ["a 40 character name", named("n".repeat(40)), "n".repeat(40)],
    ["a name of 41 characters", named("n".repeat(41)), "Error"],
    ["a name with a space", named("Type Error"), "Error"],
    ["a name starting with a digit", named("1Error"), "Error"],
    ["a name with a slash", named("Odd/Name"), "Error"],
    ["a name with a colon", named("Odd:Name"), "Error"],
    ["a name that is not a string", named(42), "Error"],
    ["a valid digest", Object.assign(new Error("marker words here"), { digest: "1234567890" }), "Error (digest 1234567890)"],
    ["a named error with a digest", named("TypeError", "d1-x_Y"), "TypeError (digest d1-x_Y)"],
    ["a 32 character digest", named("TypeError", "d".repeat(32)), `TypeError (digest ${"d".repeat(32)})`],
    ["a digest of 33 characters", named("TypeError", "d".repeat(33)), "TypeError"],
    ["a digest with a semicolon", named("TypeError", "ab;cd"), "TypeError"],
    ["a digest with a space", named("TypeError", "ab cd"), "TypeError"],
    ["a digest that is not a string", named("TypeError", 7), "TypeError"],
    ["a thrown string", "plain text", "Thrown: string"],
    ["a thrown number", 42, "Thrown: number"],
    ["a plain object with a non-string message", { message: 5, digest: "d1" }, "Thrown: object"],
    ["an object with no message", { name: "TypeError" }, "Thrown: object"],
    ["undefined", undefined, "Thrown: unknown"],
    ["null", null, "Thrown: unknown"],
    ["a boolean", true, "Thrown: unknown"],
    ["an error-like object", { message: "from an object", digest: "d1" }, "Error (digest d1)"],
  ])("reports %s as its name and digest only", (_label, value, expected) => {
    expect(errorDetail(value)).toBe(expected);
  });

  it.each(["name", "digest"] as const)("reads %s once, so a getter cannot pass the check and print another value", (field) => {
    let reads = 0;
    const value: Record<string, unknown> = { message: "marker words here", name: "TypeError", digest: "d1" };
    Object.defineProperty(value, field, {
      get() {
        reads += 1;
        return reads <= 2 ? (field === "name" ? "TypeError" : "d1") : "has some spaces";
      },
    });
    expect(errorDetail(value)).toBe("TypeError (digest d1)");
    expect(reads).toBe(1);
  });

  // Pins decision D25: message text never leaves the browser. Fails if value.message is added back.
  it.each(["alpha bravo charlie", "Cannot read properties of undefined", "React error number four eighteen"])(
    "never includes the message text: %s",
    (message) => {
      expect(errorDetail(new Error(message))).toBe("Error");
      expect(errorDetail(new TypeError(message))).toBe("TypeError");
    },
  );
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

  it("treats a non-string message as empty", () => {
    expect(windowErrorValue({ error: null, message: 42 as unknown as string })).toBeNull();
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
    expect(send).toHaveBeenCalledWith(CLIENT_ERROR_EVENT, { where: "error-page", detail: "Error" });
    expect(CLIENT_ERROR_EVENT).toBe("client_error");
  });

  it("sends nothing from a private path, or afterwards on a public one", () => {
    let path = "/private/area";
    const { send, report } = reporter({ pathname: () => path, isPrivate: (p) => p.startsWith("/private") });
    report("window", new Error("hidden"));
    expect(send).not.toHaveBeenCalled();
    path = "/";
    report("window", new Error("later"));
    expect(send).not.toHaveBeenCalled();
  });

  it("sends nothing after a visit to a private path, even for a public error", () => {
    const { send, report } = reporter({ isPrivate: (p) => p.startsWith("/private") });
    report("window", new Error("before"));
    report.visit("/private/area");
    report.visit("/");
    report("window", new TypeError("after"));
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("keeps reporting after visits to public paths only", () => {
    const { send, report } = reporter({ isPrivate: (p) => p.startsWith("/private") });
    report.visit("/");
    report.visit("/quick");
    report("window", new Error("fine"));
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("never puts message text in anything it sends", () => {
    const { send, report } = reporter();
    report("window", new Error("zebra marker words here"));
    report("error-page", Object.assign(new TypeError("zebra marker words here"), { digest: "d1" }));
    report("boundary:player", { name: "WindowError", message: "zebra marker words here" });
    expect(send).toHaveBeenCalledTimes(3);
    expect(JSON.stringify(send.mock.calls)).not.toContain("zebra");
  });

  it("sends the same where and detail once", () => {
    const { send, report } = reporter();
    report("window", new TypeError("first"));
    report("window", new TypeError("second"));
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("sends the same detail again from a different where", () => {
    const { send, report } = reporter();
    report("window", new TypeError("first"));
    report("boundary:player", new TypeError("second"));
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("stops after three reports a page load, across wheres and names", () => {
    const { send, report } = reporter();
    report("window", new TypeError("a"));
    report("boundary:cursor", new TypeError("b"));
    report("error-page", new TypeError("c"));
    report("global-error", new TypeError("d"));
    report("window", new RangeError("e"));
    expect(MAX_ERROR_REPORTS).toBe(3);
    expect(send).toHaveBeenCalledTimes(3);
  });

  it("sends the same where with two different names twice", () => {
    const { send, report } = reporter();
    report("window", new TypeError("a"));
    report("window", new RangeError("a"));
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("does not spend the budget on duplicates", () => {
    const { send, report } = reporter();
    for (let i = 0; i < 3; i += 1) report("window", new Error("same"));
    report("window", new TypeError("one"));
    report("window", new RangeError("two"));
    expect(send).toHaveBeenCalledTimes(3);
  });

  it("holds the cap when a getter reports again while the detail is built", () => {
    const { send, report } = reporter();
    const wheres: ErrorWhere[] = ["window", "unhandledrejection", "error-page"];
    const reentrant = {
      get message() {
        for (const where of wheres) report(where, new TypeError("inner"));
        return "outer";
      },
    };
    report("global-error", reentrant);
    expect(send).toHaveBeenCalledTimes(3);
  });

  it("neither throws nor sends when the message getter throws", () => {
    const { send, report } = reporter();
    const hostile = {
      get message(): string {
        throw new Error("getter");
      },
    };
    expect(() => report("window", hostile)).not.toThrow();
    expect(send).not.toHaveBeenCalled();
  });

  it.each([
    ["send", { send: () => { throw new Error("analytics blocked"); } }],
    ["pathname", { pathname: () => { throw new Error("no location"); } }],
    ["isPrivate", { isPrivate: () => { throw new Error("bad check"); } }],
  ])("never throws, even when %s does", (_label, overrides) => {
    const { report } = reporter(overrides);
    expect(() => report("window", new Error("boom"))).not.toThrow();
  });

  it("never throws from visit, even when isPrivate does", () => {
    const { report } = reporter({
      isPrivate: () => {
        throw new Error("bad check");
      },
    });
    expect(() => report.visit("/")).not.toThrow();
  });
});
