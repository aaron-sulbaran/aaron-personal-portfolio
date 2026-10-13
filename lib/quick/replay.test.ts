import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { THEME_STORAGE_KEY } from "@/lib/theme";
import { INVITE_KEY } from "./invite";
import { FIRST_VISIT_LOCAL, FIRST_VISIT_SESSION, forgetFirstVisit } from "./replay";
import { SETTINGS_KEY } from "./settings";

function memory(keys: readonly string[]) {
  const map = new Map(keys.map((key) => [key, "1"]));
  return { removeItem: (key: string) => void map.delete(key), map };
}

describe("replay first visit", () => {
  it("forgets the invite, the seen store, the hints, and the loader's saved scroll", () => {
    expect(FIRST_VISIT_LOCAL).toContain(INVITE_KEY);
    expect(FIRST_VISIT_LOCAL).toEqual(expect.arrayContaining(["aaron-hint-opened", "aaron-hint-keep", "aaron-hint-tap", "aaron-still-notice"]));
    expect(FIRST_VISIT_SESSION).toEqual(expect.arrayContaining(["aaron-explored-tiles", "aps:home-scroll-y", "aaron-soundtrack-greeted"]));
  });

  it("keeps preferences and the lab's own settings", () => {
    for (const key of [THEME_STORAGE_KEY, "aaron-soundtrack", SETTINGS_KEY]) expect([...FIRST_VISIT_LOCAL, ...FIRST_VISIT_SESSION]).not.toContain(key);
  });

  it("clears both stores and survives blocked storage", () => {
    const local = memory([...FIRST_VISIT_LOCAL, THEME_STORAGE_KEY]);
    const session = memory([...FIRST_VISIT_SESSION]);
    forgetFirstVisit(local, session);
    expect([...local.map.keys()]).toEqual([THEME_STORAGE_KEY]);
    expect(session.map.size).toBe(0);
    const blocked = { removeItem: () => { throw new Error("blocked"); } };
    expect(() => forgetFirstVisit(blocked, null)).not.toThrow();
  });

  it("matches the key the loader's skip script reads", () => {
    const markup = readFileSync(join(process.cwd(), "components/loader/loaderMarkup.ts"), "utf8");
    const read = markup.match(/sessionStorage\.getItem\("([^"]+)"\)/)?.[1];
    expect(FIRST_VISIT_SESSION).toContain(read);
  });
});
