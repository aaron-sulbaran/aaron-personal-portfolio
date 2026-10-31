import { describe, expect, it } from "vitest";
import { siteContent } from "@/lib/content";
import { parseInlineLinks } from "@/lib/content/links";
import { modalPhotos } from "@/lib/content/media";
import { register, registerHas, resolveTip } from "@/lib/content/register";

describe("the inline register", () => {
  it("holds the approved keys and only those", () => {
    expect(Object.keys(register.def)).toEqual(["product", "voltage", "arc"]);
    expect(Object.keys(register.tip)).toEqual(["two-as", "voltaage", "killer-drones", "music-note", "ieee-ao", "this-site-playground"]);
    expect(Object.keys(register.pop)).toEqual(["leadership-award", "sandboarding", "downhill-skating", "skydiving", "rock-climbing", "venezuela-flag", "family", "friends", "wanderlust", "misuki-suki", "matcha", "sister-kyoto", "contrabass-clarinet", "rango", "catatumbo-lightning", "lake-maracaibo", "3d-printing", "ut-ece-logo", "tool-user", "bambu-h2s", "steve-jobs-iphone"]);
  });

  it("keeps no hover tip for the jobs' employers: their tips are name tags on the page now", () => {
    expect(Object.keys(register.tip).filter((key) => key.startsWith("job-"))).toEqual([]);
    expect(registerHas("tip", "job-0")).toBe(false);
    for (const entry of siteContent.cards.jobs.timeline) expect(Object.values(register.tip).map((tip) => tip.text)).not.toContain(entry.tip);
  });

  it("is the register siteContent carries", () => {
    expect(siteContent.register).toBe(register);
  });

  it("holds no tip still marked proposed", () => {
    expect(Object.entries(register.tip).filter(([, entry]) => entry.proposed).map(([key]) => key)).toEqual([]);
  });

  it("gives the gamer tag tip its one https link, and no other tip a link", () => {
    expect(register.tip.voltaage.link).toEqual({ href: "https://profile.playstation.com/VoltaageArc", label: "VoltaageArc on most platforms" });
    for (const [key, entry] of Object.entries(register.tip)) {
      if (!entry.link) continue;
      expect(entry.link.href, key).toMatch(/^https:\/\/\S+$/);
      expect(entry.link.label.trim(), key).not.toBe("");
    }
    expect(Object.entries(register.tip).filter(([, entry]) => entry.link).map(([key]) => key)).toEqual(["voltaage"]);
  });

  it("defines the mark card's two electrical terms in my words", () => {
    expect(register.def.voltage).toEqual({ title: "Voltage", body: ["the difference in electric potential between two points"] });
    expect(register.def.arc).toEqual({ title: "Arc", body: ["a continuous electrical discharge that occurs when electric current flows through an air gap between two electrodes"] });
  });

  it("defines product in Aaron's words: three paragraphs with three photo pops, still opened by a click and still hinted", () => {
    expect(register.def.product.title).toBe("What a product is");
    expect(register.def.product.body).toEqual([
      "A product (to me) is a tool that's genuinely useful to someone and easy for them to [pick up](pop:tool-user). If it's for everyone, anyone should get it on their first try. If it's for niche hobbyists, the hobbyists in that community should [get it immediately](pop:bambu-h2s).",
      "About 99% of the time, a product should be built for the user instead of forcing the user to get used to the product.",
      "The other 1% is how you get a moonshot product like [the iPhone](pop:steve-jobs-iphone), which didn't just change the way people use a phone (the product), it changed the world.",
    ]);
    expect(register.def.product.hint).toBe("click to read how I define a product");
    // Every pop the paragraphs point at is in the register, so none falls back to plain words.
    for (const paragraph of register.def.product.body) expect(parseInlineLinks(paragraph, registerHas).unknown).toEqual([]);
    expect(register.def.product.body.join(" ").match(/\(pop:[a-z0-9-]+\)/g)).toEqual(["(pop:tool-user)", "(pop:bambu-h2s)", "(pop:steve-jobs-iphone)"]);
  });

  it("gives every pop with a photo a caption line, so a popover never shows a bare picture, except the tool-user meme, which is captionless on purpose", () => {
    const bare = Object.entries(register.pop).filter(([, entry]) => entry.file && !entry.caption?.trim()).map(([key]) => key);
    expect(bare).toEqual(["tool-user"]);
    expect(register.pop["tool-user"].alt).toBe("A stick figure holding a hammer, labeled: this part fits the problem, this part fits the user");
  });

  it("describes every pop without the third person, with its exported file, the approved captions and link", () => {
    for (const [key, entry] of Object.entries(register.pop)) {
      expect(entry.alt).not.toMatch(/\bAaron\b/);
      // "wanderlust" is the one pop that shows a card photo: the Mt. Fuji picture from the Travel card's modal, not a file of its own.
      expect(entry.file?.src, key).toBe(key === "wanderlust" ? "/photos/cards/travel-1-fuji.jpg" : `/photos/pops/${key}.jpg`);
    }
    const captions = Object.fromEntries(Object.entries(register.pop).filter(([, entry]) => entry.caption).map(([key, entry]) => [key, entry.caption]));
    expect(captions).toEqual({
      "leadership-award": "Getting the Cockrell School undergraduate leadership award.",
      sandboarding: "Sandboarding on dunes just outside of Dubai",
      "downhill-skating": "A collection of boards, although only half of these are mine",
      skydiving: "Me on my first jump, look at that smile!",
      "rock-climbing": "Catch me on El Capitan next... right...",
      "venezuela-flag": "Me repping my flag at SHPE 2025!",
      family: 'My family posing in front of the UT tower. We call this alternating pose, "la tipica"',
      friends: "Celebrating some of my best friends' graduation!",
      wanderlust: "Me at Mount Fuji on my second trip to Japan.",
      "misuki-suki": "Suki's S2000 from 2 Fast 2 Furious, what I consider to be a peak roadster",
      matcha: "7T+ is my favorite matcha place in the world. Check it out in Kyoto! (click for directions)",
      "sister-kyoto": "Me with my sister at Fushimi Inari in Kyoto, doing our signature head bop. This siblings' Japan trip is probably my favorite so far!",
      "contrabass-clarinet": "Bass clarinet was my main instrument. In concert season I played contrabass.",
      rango: "yeah, this guy from that one kid's movie",
      "catatumbo-lightning": "The lightning in question",
      "lake-maracaibo": "The famous Puente General Rafael Urdaneta over Lake Maracaibo.",
      "3d-printing": "My at-home workbench. This is where I tinker with my personal hardware projects.",
      "ut-ece-logo": "UT Austin Electrical and Computer Engineering",
      "bambu-h2s": "Bambu Lab's H2S Combo printer, the type hobbyists know is the best on the market.",
      "steve-jobs-iphone": "Steve Jobs introducing the first iPhone in 2007.",
    });
    expect(Object.values(register.pop).every((entry) => entry.crop === null)).toBe(true);
    expect(Object.entries(register.pop).filter(([, entry]) => entry.href).map(([key, entry]) => [key, entry.href])).toEqual([["matcha", "https://maps.app.goo.gl/4KPkA9BV3CjAPwvg6"]]);
  });

  it("pops the Mt. Fuji photo on \"wanderlust\", the Travel card's own picture with its alt and caption, no file of its own", () => {
    const fuji = modalPhotos.travel[0];
    expect(fuji.src).toBe("/photos/cards/travel-1-fuji.jpg");
    expect(register.pop.wanderlust).toEqual({ file: { src: fuji.src, width: 1200, height: 1600 }, alt: "Me on a street in Japan with Mt. Fuji behind me", caption: "Me at Mount Fuji on my second trip to Japan.", crop: null });
    expect(registerHas("pop", "wanderlust")).toBe(true);
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

  it("drops a tip's adapting clause while no adapted track plays", () => {
    const entry = { text: "Songs I like, and I adapted one myself.", adaptedClause: ", and I adapted one myself" };
    expect(resolveTip(entry, false)).toBe("Songs I like.");
    expect(resolveTip(entry, true)).toBe(entry.text);
    expect(resolveTip(register.tip["killer-drones"], false)).toBe("unless it's killer drones, I don't do that");
    for (const [key, entry] of Object.entries(register.tip)) if (entry.adaptedClause) expect(entry.text.includes(entry.adaptedClause), key).toBe(true);
  });
  it("labels every pop link for the touch label", () => {
    for (const [key, entry] of Object.entries(register.pop)) if (entry.href) expect(entry.hrefLabel, key).toBeTruthy();
    expect(register.pop.matcha.hrefLabel).toBe("Open in Google Maps");
  });
});
