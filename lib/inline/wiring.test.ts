import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Where the copy carries links (docs/content/who-i-am.md,
// connect-footer-band.md, mark-card.md). C5 reshapes the strings; these sites
// must keep rendering through InlineCopy, or the markup shows as text.
const WIRED: Array<[string, string]> = [
  ["components/WhoIAm.tsx", "paragraph"],
  ["components/Connect.tsx", "lede"],
  ["components/soundtrack/BandInvite.tsx", "c.body"],
  ["components/soundtrack/BandInvite.tsx", "c.acceptedNote"],
  ["components/mark/MarkCard.tsx", "line"],
];

describe("copy that carries links", () => {
  it.each(WIRED)("%s renders %s through InlineCopy", (file, expression) => {
    expect(readFileSync(join(process.cwd(), file), "utf8")).toContain(`<InlineCopy source={${expression}} />`);
  });
});
