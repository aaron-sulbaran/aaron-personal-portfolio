import { describe, expect, it } from "vitest";
import { cards } from "./cards";
import { jobTags } from "./jobTags";
import { quickEntries } from "./quick";

describe("a job's name tag", () => {
  it("is one tag per timeline entry, newest first, carrying the entry's own words", () => {
    expect(jobTags.map((tag) => tag.employer)).toEqual(["Aritzia", "Apple", "Student mentor, UT Austin", "MOD Pizza", "Popeyes"]);
    expect(jobTags.map((tag) => tag.when)).toEqual(["2025 to 2026", "2024 to 2025", "Sophomore year of college", "Sophomore to senior year of high school", "Sophomore year of high school"]);
    jobTags.forEach((tag, i) => {
      expect(tag.tip, tag.employer).toBe(cards.jobs.timeline[i].tip);
      expect(tag.logo, tag.employer).toBe(cards.jobs.timeline[i].logo);
    });
  });

  it("takes the role from the timeline entry where it has one, and otherwise from quick.ts's jobs entries without the year", () => {
    expect(jobTags.map((tag) => tag.role)).toEqual(["Sales Associate", "Specialist, then technical specialist", "Student Mentor", "All-Star Squad Member", "Shift Lead"]);
    // Only Apple's role is the timeline's own; the other four are quick.ts's, never written a second time here.
    expect(cards.jobs.timeline.map((entry) => entry.role)).toEqual([null, "Specialist, then technical specialist", null, null, null]);
    for (const tag of jobTags) {
      const entry = quickEntries.find((candidate) => candidate.id === "jobs" && candidate.tileLogo === tag.logo)!;
      expect(entry, tag.employer).toBeDefined();
      if (!cards.jobs.timeline.find((job) => job.employer === tag.employer)!.role) expect(entry.role.startsWith(tag.role!), tag.employer).toBe(true);
      expect(tag.role, tag.employer).not.toMatch(/\b20\d\d\b/);
    }
  });

  it("has a logo, a role, a when and a tip on every tag, so none shows an empty line", () => {
    for (const tag of jobTags) {
      expect(tag.logo, tag.employer).not.toBeNull();
      expect(tag.role?.trim(), tag.employer).toBeTruthy();
      expect(tag.when.trim(), tag.employer).toBeTruthy();
      expect(tag.tip.trim(), tag.employer).toBeTruthy();
    }
  });
});
