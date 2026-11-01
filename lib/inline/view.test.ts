import { describe, expect, it } from "vitest";
import { siteContent } from "@/lib/content";
import { tipText } from "@/lib/content/tracks";
import { holdsLink, popView, shownLink, tipView } from "@/lib/inline/view";
const { pop } = siteContent.register;
describe("tipView", () => {
  it("shows a tip's words, and the music note as tipText gives it", () => {
    const drones = "unless it's killer drones, I don't do that";
    expect(tipView("tip", "killer-drones")).toEqual({ text: drones, photo: null, caption: null, link: null, description: drones });
    expect(tipView("tip", "music-note")?.text).toBe(tipText("music-note"));
  });
  it("returns null for a key the register lacks, prototype keys included", () => {
    expect(tipView("tip", "rango")).toBeNull();
    expect(tipView("pop", "constructor")).toBeNull();
    expect(tipView("def", "toString")).toBeNull();
  });
  it("shows a definition's hint as the hover line, and nothing when it has none", () => {
    const hint = "click to read how I define a product";
    expect(tipView("def", "product")).toEqual({ text: hint, photo: null, caption: null, link: null, description: hint });
    expect(tipView("def", "voltage")).toBeNull();
    expect(holdsLink("def", "product")).toBe(false);
  });
  it("shows a landed pop as its photo and caption, described by both alt and caption", () => {
    const clarinet = pop["contrabass-clarinet"];
    expect(tipView("pop", "contrabass-clarinet")).toEqual({
      text: null,
      photo: { ...clarinet.file, alt: clarinet.alt, displayWidth: 270, displayHeight: 360, fit: "cover", sizes: "270px" },
      caption: clarinet.caption,
      link: null,
      description: `${clarinet.alt}. ${clarinet.caption}`,
    });
    expect(tipView("pop", "sandboarding")).toMatchObject({ text: null, caption: pop.sandboarding.caption, description: `${pop.sandboarding.alt}. ${pop.sandboarding.caption}` });
  });
  it("shows Rango as a landed pop, described by its alt and caption", () => {
    expect(tipView("pop", "rango")).toEqual({
      text: null,
      photo: { ...pop.rango.file, alt: pop.rango.alt, displayWidth: 270, displayHeight: 360, fit: "cover", sizes: "270px" },
      caption: "yeah, this guy from that one kid's movie",
      link: null,
      description: "Rango, the chameleon in a Hawaiian shirt, in a dance pose. yeah, this guy from that one kid's movie",
    });
  });
  it("shows the tool-user meme with no caption at all, so its popover is the photo alone, still described by its alt", () => {
    const meme = siteContent.register.pop["tool-user"];
    expect(meme.caption, "no caption on purpose").toBeUndefined();
    expect(tipView("pop", "tool-user")).toMatchObject({ text: null, caption: null, link: null, description: meme.alt });
    expect(tipView("pop", "tool-user")?.photo).toMatchObject({ src: "/photos/pops/tool-user.jpg", alt: meme.alt, displayWidth: 558, displayHeight: 338, fit: "whole" });
    expect(tipView("pop", "bambu-h2s")?.caption).toBe("Bambu Lab's H2S Combo printer, the type hobbyists know is the best on the market.");
    expect(tipView("pop", "steve-jobs-iphone")?.caption).toBe("Steve Jobs introducing the first iPhone in 2007.");
  });
  it("carries the matcha's Maps link and label", () => { expect(tipView("pop", "matcha")?.link).toEqual({ href: pop.matcha.href, label: "Open in Google Maps" }); });
});
describe("the gamer tag tip's link", () => {
  it("carries its words and its https link, described by the words alone", () => {
    expect(tipView("tip", "voltaage")).toEqual({
      text: siteContent.register.tip.voltaage.text,
      photo: null,
      caption: null,
      link: { href: "https://profile.playstation.com/VoltaageArc", label: "VoltaageArc on most platforms" },
      description: siteContent.register.tip.voltaage.text,
    });
  });
  it("holds a link only for a tip that has one, and shows a tip's link always but a pop's only once tapped", () => {
    expect(holdsLink("tip", "voltaage")).toBe(true);
    expect(holdsLink("tip", "killer-drones")).toBe(false);
    expect(holdsLink("pop", "matcha")).toBe(false);
    expect(shownLink("tip", "voltaage", "hover")?.label).toBe("VoltaageArc on most platforms");
    expect(shownLink("tip", "killer-drones", "tap")).toBeNull();
    expect(shownLink("pop", "matcha", "hover")).toBeNull();
    expect(shownLink("pop", "matcha", "tap")?.label).toBe("Open in Google Maps");
  });
});
describe("popView", () => {
  it("shows a pop's caption, or its alt, until its photo lands, and is described by both", () => {
    const alt = "Me at the lake";
    const caption = "The lake in June.";
    expect(popView({ file: null, alt, caption, crop: null })).toMatchObject({ text: null, photo: null, caption, description: `${alt}. ${caption}` });
    expect(popView({ file: null, alt, crop: null })).toMatchObject({ text: alt, photo: null, caption: null, description: alt });
  });
  it("draws a landed photo at the one pop height, its width following its own shape, a landscape wider than a portrait", () => {
    const landscape = popView({ file: { src: "/inline/x.jpg", width: 800, height: 600 }, alt: "Me", crop: null });
    expect(landscape.photo).toEqual({ src: "/inline/x.jpg", width: 800, height: 600, alt: "Me", displayWidth: 480, displayHeight: 360, fit: "cover", sizes: "480px" });
    expect(landscape.text).toBeNull();
    const portrait = popView({ file: { src: "/inline/y.jpg", width: 600, height: 800 }, alt: "Me", crop: null });
    expect(portrait.photo).toMatchObject({ displayWidth: 270, displayHeight: 360, fit: "cover" });
  });
  it("shows every pop photo of every register entry at the same height, bar the very wide few it shows whole", () => {
    const heights = new Set<number>();
    const whole: string[] = [];
    for (const [key, entry] of Object.entries(pop)) {
      const photo = popView(entry).photo;
      if (!photo) continue;
      if (photo.fit === "whole") whole.push(key);
      else heights.add(photo.displayHeight);
    }
    expect([...heights]).toEqual([360]);
    expect(whole).toEqual(["ut-ece-logo", "tool-user"]);
  });
});
