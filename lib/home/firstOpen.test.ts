import { describe, expect, it } from "vitest";
import { hintStore } from "@/lib/cursor/hover";
import { CARD_OPENED_KEY, firstOpenStore } from "@/lib/home/firstOpen";

describe("first open store", () => {
  it("the prompt's key is the cursor's once-ever key, not a second one", () => {
    expect(CARD_OPENED_KEY).toBe("aaron-hint-opened");
  });

  it("firstOpenStore reads and writes the hint store", () => {
    firstOpenStore().forget();
    expect(firstOpenStore().openedBefore()).toBe(false);
    hintStore().markOpened();
    expect(firstOpenStore().openedBefore()).toBe(true);
  });
});
