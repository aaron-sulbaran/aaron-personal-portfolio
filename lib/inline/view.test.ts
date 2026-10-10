import { describe, expect, it } from "vitest";
import { siteContent } from "@/lib/content";
import { tipText } from "@/lib/content/tracks";
import { POP_PHOTO_SIZES } from "@/lib/photoSizes";
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
  });
  it("shows a landed pop as its photo and caption, described by both alt and caption", () => {
    const clarinet = pop["contrabass-clarinet"];
    expect(tipView("pop", "contrabass-clarinet")).toEqual({
      text: null,
      photo: { ...clarinet.file, alt: clarinet.alt, displayWidth: 280, displayHeight: 373 },
      caption: clarinet.caption,
      link: null,
      description: `${clarinet.alt}. ${clarinet.caption}`,
    });
    expect(tipView("pop", "sandboarding")).toMatchObject({ text: null, caption: pop.sandboarding.caption, description: `${pop.sandboarding.alt}. ${pop.sandboarding.caption}` });
  });
  it("shows Rango as a landed pop, described by its alt and caption", () => {
    expect(tipView("pop", "rango")).toEqual({
      text: null,
      photo: { ...pop.rango.file, alt: pop.rango.alt, displayWidth: 280, displayHeight: 374 },
      caption: "yeah, this guy from that one kid's movie",
      link: null,
      description: "Rango, the chameleon in a Hawaiian shirt, in a dance pose. yeah, this guy from that one kid's movie",
    });
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
    expect(popView({ file: null, alt, caption: null, crop: null })).toMatchObject({ text: alt, photo: null, caption: null, description: alt });
  });
  it("sizes a landed photo 280px wide at its own aspect", () => {
    const view = popView({ file: { src: "/inline/x.jpg", width: 800, height: 600 }, alt: "Me", caption: null, crop: null });
    expect(view.photo).toEqual({ src: "/inline/x.jpg", width: 800, height: 600, alt: "Me", displayWidth: 280, displayHeight: 210 });
    expect(view.text).toBeNull();
    expect(POP_PHOTO_SIZES).toBe("280px");
  });
});
