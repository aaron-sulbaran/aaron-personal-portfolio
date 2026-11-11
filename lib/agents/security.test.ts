import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { agentsCopy } from "@/lib/content/agents";
import { siteContent } from "@/lib/content";

const file = readFileSync(join(process.cwd(), "public/.well-known/security.txt"), "utf8");
const field = (name: string) => file.split("\n").find((line) => line.startsWith(`${name}:`))?.slice(name.length + 1).trim();

describe("security.txt", () => {
  it("contacts the email Connect shows", () => {
    const email = siteContent.connect.links.find((entry) => entry.key === "email")!;
    expect(field("Contact")).toBe(email.href);
  });

  it("expires when the copy says and is still in the future", () => {
    expect(field("Expires")).toBe(agentsCopy.security.expires);
    expect(new Date(field("Expires")!).getTime()).toBeGreaterThan(Date.now());
  });

  it("names its languages and its canonical address", () => {
    expect(field("Preferred-Languages")).toBe(agentsCopy.security.languages);
    expect(field("Canonical")).toBe("https://aaronsulbaran.com/.well-known/security.txt");
  });

  it("uses no em dash", () => {
    expect(file).not.toContain(String.fromCharCode(0x2014));
  });
});
