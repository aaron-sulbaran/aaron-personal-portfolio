import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { siteContent } from "@/lib/content";
import { parseInlineLinks, plainText } from "@/lib/content/links";
import { registerHas } from "@/lib/content/register";
import { walkStrings } from "@/lib/testing/walk";

// Every string siteContent holds, old shapes and new.
const leaves = walkStrings(siteContent);

describe("every string in siteContent", () => {
  it("never uses an em dash", () => {
    expect(leaves.filter((leaf) => leaf.text.includes("\u2014")).map((leaf) => leaf.path)).toEqual([]);
  });

  it("points every inline link at the register or an https page", () => {
    expect(leaves.flatMap((leaf) => parseInlineLinks(leaf.text, registerHas).unknown.map((link) => `${leaf.path}: [${link.text}](${link.target})`))).toEqual([]);
  });

  it("leaves no half-written link behind", () => {
    expect(leaves.filter((leaf) => /[[\]]/.test(plainText(leaf.text))).map((leaf) => leaf.path)).toEqual([]);
  });

  it("points every local file reference at a file in public", () => {
    const files = leaves.filter((leaf) => /(?:^|\.)(?:src|srcDark|logo|cover)$/.test(leaf.path) && leaf.text.startsWith("/"));
    expect(files.length).toBeGreaterThan(0);
    expect(files.filter((leaf) => !existsSync(join(process.cwd(), "public", leaf.text))).map((leaf) => `${leaf.path}: ${leaf.text}`)).toEqual([]);
  });

  it("never describes me in the third person in an alt", () => {
    const alts = leaves.filter((leaf) => /(?:^|\.)alt$/.test(leaf.path));
    expect(alts.length).toBeGreaterThan(0);
    for (const leaf of alts) expect(leaf.text, leaf.path).not.toMatch(/\bAaron\b/);
  });
});
