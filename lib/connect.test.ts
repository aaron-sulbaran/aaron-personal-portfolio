import { describe, expect, it } from "vitest";
import { siteContent } from "@/lib/content";
import { splitAfterAt } from "@/lib/connect";

describe("splitAfterAt", () => {
  it("lets an address wrap after its at sign", () => {
    expect(splitAfterAt("aarondsulbaran@gmail.com")).toEqual(["aarondsulbaran@", "gmail.com"]);
  });

  it("keeps a leading at sign with its handle", () => {
    expect(splitAfterAt("@imaaronsulbaran")).toEqual(["@imaaronsulbaran"]);
  });

  it("leaves a handle with no at sign whole", () => {
    expect(splitAfterAt("in/aaron-sulbaran")).toEqual(["in/aaron-sulbaran"]);
  });

  it("gives back every handle's words unchanged", () => {
    for (const link of siteContent.connect.links) expect(splitAfterAt(link.handle).join("")).toBe(link.handle);
  });
});
