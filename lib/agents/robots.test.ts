import { describe, expect, it } from "vitest";
import { buildRobotsTxt } from "./robots";

const robots = buildRobotsTxt();

describe("robots.txt", () => {
  it("carries the content signal and allows everything", () => {
    expect(robots).toContain("Content-Signal: search=yes, ai-input=yes, ai-train=yes");
    expect(robots).toContain("Allow: /\n");
  });

  it("disallows nothing", () => {
    expect(robots).not.toMatch(/disallow/i);
  });

  it("is one group naming no path but the root", () => {
    expect(robots.match(/^User-agent:/gm)).toHaveLength(1);
    const paths = robots.split("\n").filter((line) => /^(Allow|Disallow):/i.test(line));
    expect(paths).toEqual(["Allow: /"]);
  });

  it("points at the sitemap and the agent guide, and uses no em dash", () => {
    expect(robots).toContain("\nSitemap: https://aaronsulbaran.com/sitemap.xml\n");
    expect(robots).toContain("https://aaronsulbaran.com/llms.txt");
    expect(robots).not.toContain(String.fromCharCode(0x2014));
  });
});
