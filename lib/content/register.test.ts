import { describe, expect, it } from "vitest";
import { siteContent } from "@/lib/content";
import { parseInlineLinks } from "@/lib/content/links";
import { register, registerHas, resolveTip } from "@/lib/content/register";

const musicNoteWithoutAdapting =
  "I'm not playing my usual playlist (a lot of Tyler, the Creator, Childish Gambino and Steve Lacy) because I don't own it, and I picked music that's easy to read to. The credits are in the corner.";

describe("the inline register", () => {
  it("holds the approved keys and only those", () => {
    expect(Object.keys(register.def)).toEqual(["product"]);
    expect(Object.keys(register.tip)).toEqual(["voltage", "two-as", "voltaage", "killer-drones", "evolving-isle", "music-note", "ieee-ao", "this-site-playground", "misuki-suk"]);
    expect(Object.keys(register.pop)).toEqual(["leadership-award", "sandboarding", "downhill-skating", "skydiving", "rock-climbing", "venezuela-flag", "matcha", "sister-kyoto", "contrabass-clarinet", "rango"]);
  });

  it("is the register siteContent carries", () => {
    expect(siteContent.register).toBe(register);
  });

  it("keeps one proposed tip, flagged", () => {
    expect(Object.entries(register.tip).filter(([, entry]) => entry.proposed).map(([key]) => key)).toEqual(["voltaage"]);
  });

  it("defines product in Aaron's words", () => {
    expect(register.def.product.title).toBe("What a product is");
    expect(register.def.product.body.startsWith("A product (to me) is a tool that's genuinely useful")).toBe(true);
  });

  it("describes every pop without the third person, with its exported file, the approved captions and link", () => {
    for (const [key, entry] of Object.entries(register.pop)) {
      expect(entry.alt).not.toMatch(/\bAaron\b/);
      expect(entry.file?.src, key).toBe(`/photos/pops/${key}.jpg`);
    }
    const captions = Object.fromEntries(Object.entries(register.pop).filter(([, entry]) => entry.caption).map(([key, entry]) => [key, entry.caption]));
    expect(captions).toEqual({
      "leadership-award": "Getting the Cockrell School undergraduate leadership award.",
      matcha: "7T+ is my favorite matcha place in the world, literally in the world. This one is in Kyoto.",
      "contrabass-clarinet": "Bass clarinet was my main instrument. In concert season I played contrabass.",
      rango: "yeah, this guy from that one kid's movie",
    });
    expect(Object.values(register.pop).every((entry) => entry.crop === null)).toBe(true);
    expect(Object.entries(register.pop).filter(([, entry]) => entry.href).map(([key, entry]) => [key, entry.href])).toEqual([["matcha", "https://www.google.com/maps/search/?api=1&query=35.0025497%2C135.7652173"]]);
  });

  it("shows Rango as a photo pop with a film character's alt, and no longer as a tip", () => {
    expect(register.pop.rango).toEqual({ file: { src: "/photos/pops/rango.jpg", width: 599, height: 800 }, alt: "Rango, the chameleon in a Hawaiian shirt, in a dance pose", caption: "yeah, this guy from that one kid's movie", crop: null });
    expect(registerHas("pop", "rango")).toBe(true);
    expect(registerHas("tip", "aango")).toBe(false);
    expect(registerHas("tip", "rango")).toBe(false);
  });

  it("knows a key only when the register itself holds it", () => {
    expect(registerHas("tip", "ieee-ao")).toBe(true);
    expect(registerHas("pop", "ieee-ao")).toBe(false);
    expect(registerHas("tip", "constructor")).toBe(false);
    expect(registerHas("def", "toString")).toBe(false);
    expect(parseInlineLinks("[x](tip:constructor)", registerHas).unknown).toEqual([{ text: "x", target: "tip:constructor" }]);
  });

  it("drops the music note's adapting clause while no adapted track plays", () => {
    const note = register.tip["music-note"];
    expect(Boolean(note.adaptedClause && note.text.includes(note.adaptedClause))).toBe(true);
    for (const [key, entry] of Object.entries(register.tip)) if (entry.adaptedClause) expect(entry.text.includes(entry.adaptedClause), key).toBe(true);
    expect(resolveTip(note, false)).toBe(musicNoteWithoutAdapting);
    expect(resolveTip(note, true)).toBe(note.text);
    expect(resolveTip(register.tip["killer-drones"], false)).toBe("unless it's killer drones, I don't do that");
  });
  it("labels every pop link for the touch label", () => {
    for (const [key, entry] of Object.entries(register.pop)) if (entry.href) expect(entry.hrefLabel, key).toBeTruthy();
    expect(register.pop.matcha.hrefLabel).toBe("Open in Google Maps");
  });
});
