import { describe, expect, it } from "vitest";
import { bookColumns, siteContent, strandCardByKey, strandCards } from "@/lib/content";

describe("the strand as cards", () => {
  it("is the fourteen cards in strand order, the lead card first", () => {
    expect(strandCards.map((card) => card.key)).toEqual(siteContent.strand.order);
    expect(strandCards[0].key).toBe("mentorship");
  });
  it("flies a photo card into the card picture and every other card into the header tile", () => {
    expect(Object.fromEntries(strandCards.map((card) => [card.key, card.kind === "photo" ? card.face.kind : `work:${card.face.kind}`]))).toEqual({
      mentorship: "photo", "min-max": "work:logo", band: "photo", talos: "work:logo", travel: "photo", "capital-one": "work:logo", hackathons: "photo",
      anthropic: "work:logo", misuki: "photo", ieee: "work:logo", jobs: "work:circles", "this-site": "work:mark", fsdatalink: "work:logo", "building-in-public": "photo",
    });
  });
  it("draws each face from the approved files", () => {
    expect(strandCardByKey.get("mentorship")?.face).toEqual({ kind: "photo", src: "/photos/cards/mentorship-picture.jpg" });
    const talos = strandCardByKey.get("talos")?.face;
    expect(talos?.kind === "logo" && talos.tile).toBe("anvil");
    const jobs = strandCardByKey.get("jobs")?.face;
    expect(jobs?.kind === "circles" && jobs.logos.map((logo) => logo.src)).toEqual([
      "/work/logos/jobs/popeyes-logo.svg", "/work/logos/jobs/mod-pizza-logo.svg", "/work/logos/jobs/ut-austin-logo.svg", "/work/logos/jobs/apple-logo-black.svg", "/work/logos/jobs/aritzia-logo.svg",
    ]);
    const ieee = strandCardByKey.get("ieee")?.face;
    expect(ieee?.kind === "logo" && ieee.logo.opaque).toBe(true);
  });
});

describe("the book as cards", () => {
  it("is Work then People, in Aaron's doc order, every row a card", () => {
    expect(bookColumns.map((column) => column.heading)).toEqual(["Work", "People"]);
    expect(bookColumns.map((column) => column.rows.map((row) => row.key))).toEqual([siteContent.book.workOrder, siteContent.book.peopleOrder]);
  });
  it("shows each meta as a visitor reads it, with no link inside a row", () => {
    const rows = Object.fromEntries(bookColumns.flatMap((column) => column.rows).map((row) => [row.key, [row.title, row.meta]]));
    expect(rows).toEqual({
      "min-max": ["min/Max", "Founder, 2025 to now"],
      talos: ["Talos", "Builder, 2026"],
      "capital-one": ["Capital One", "Intern, 2024 to 2026"],
      anthropic: ["Anthropic", "Claude Campus Ambassador, 2026"],
      ieee: ["IEEE UT Austin", "President, Corporate Director, and AO, 2023 to 2026"],
      hackathons: ["Hackathons", "Builder, 2026 to now"],
      "this-site": ["This site", "Portfolio (design playground), 2026"],
      mentorship: ["Mentorship", "Coach, tutor and speaker, ongoing"],
      band: ["Jordan High School band", "Section leader to drum major, 2021 to 2023"],
      jobs: ["\"unflattering\" jobs that paid for school", "Popeyes to Aritzia, 2021 to 2026"],
      fsdatalink: ["The family business", "Assistant Manager & SWE, 2022 to 2024"],
      misuki: ["Misuki", "2001 Mazda Miata, five-speed"],
      travel: ["Travel", "Yosemite, Mt. Fuji and more"],
      "building-in-public": ["Building in public", "LinkedIn and X, ongoing"],
    });
  });
});
