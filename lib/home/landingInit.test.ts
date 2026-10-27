import { describe, expect, it } from "vitest";
import { landingInitScript } from "@/lib/home/landingInit";

// The head script, run against a stub of the page.
function run({ path = "/", hash = "" }: { path?: string; hash?: string } = {}) {
  const attrs = new Map<string, string>();
  const document = { documentElement: { setAttribute: (name: string, value: string) => void attrs.set(name, value) } };
  const location = { pathname: path, hash };
  new Function("document", "location", landingInitScript())(document, location);
  return attrs;
}

describe("the instant landing's head script", () => {
  it("marks a load of the home with a section's hash, whichever section", () => {
    for (const hash of ["#work", "#numbers", "#connect", "#about"]) expect(run({ hash }).get("data-landing"), hash).toBe("instant");
  });

  it("marks nothing for a plain load, the skip link's hash or another page", () => {
    expect(run().has("data-landing")).toBe(false);
    expect(run({ hash: "#main" }).has("data-landing")).toBe(false);
    expect(run({ hash: "#" }).has("data-landing")).toBe(false);
    expect(run({ path: "/quick", hash: "#work" }).has("data-landing")).toBe(false);
  });

  it("does not throw when the page cannot answer, and holds no em dash", () => {
    const document = { documentElement: { setAttribute: () => { throw new Error("blocked"); } } };
    expect(() => new Function("document", "location", landingInitScript())(document, { pathname: "/", hash: "#work" })).not.toThrow();
    expect(landingInitScript()).not.toContain("—");
  });
});
