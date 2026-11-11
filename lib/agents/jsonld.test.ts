import { describe, expect, it } from "vitest";
import { buildPersonJsonLd, jsonLdString } from "./jsonld";

type Node = Record<string, unknown> & { "@type": string };
const graph = buildPersonJsonLd()["@graph"] as Node[];
const person = graph.find((node) => node["@type"] === "Person")!;

describe("person JSON-LD", () => {
  it("holds a WebSite and a Person", () => {
    expect(graph.map((node) => node["@type"]).sort()).toEqual(["Person", "WebSite"]);
  });

  it("names the person, the role and the university", () => {
    expect(person.name).toBe("Aaron Sulbaran");
    expect(person.jobTitle).toBe("Product-focused engineer");
    expect(person.alumniOf).toMatchObject({ name: "The University of Texas at Austin" });
    expect(person.url).toBe("https://aaronsulbaran.com");
  });

  it("links the four profiles and carries no email", () => {
    expect(person.sameAs).toEqual([
      "https://www.linkedin.com/in/aaron-sulbaran/",
      "https://github.com/aaron-sulbaran",
      "https://www.instagram.com/aaron.sulbaran/",
      "https://x.com/imaaronsulbaran",
    ]);
    expect(jsonLdString(buildPersonJsonLd())).not.toMatch(/mailto|@gmail/);
  });

  it("escapes a less-than sign so the data cannot close the script", () => {
    expect(jsonLdString({ a: "</script><b>" })).not.toContain("<");
    expect(jsonLdString({ a: "<" })).toContain("\\u003c");
  });
});
