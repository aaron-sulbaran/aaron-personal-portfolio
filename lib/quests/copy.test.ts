import { describe, expect, it } from "vitest";
import { questCopy } from "@/lib/content/quests";

function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (typeof value === "function") out.push(String((value as (...args: number[]) => unknown)(3, 25)));
  else if (value && typeof value === "object") Object.values(value).forEach((item) => strings(item, out));
  return out;
}

describe("quest copy", () => {
  it("has no em dashes", () => {
    const all = strings(questCopy);
    expect(all.length).toBeGreaterThan(10);
    for (const text of all) expect(text).not.toContain("—");
  });
});
