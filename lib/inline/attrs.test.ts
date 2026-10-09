import { describe, expect, it } from "vitest";
import { siteContent } from "@/lib/content";
import { inlineRuns, visibleText, type InlineRun } from "@/lib/content/links";
import { registerHas } from "@/lib/content/register";
import { inlineLinkElement } from "@/lib/inline/attrs";
import { walkStrings } from "@/lib/testing/walk";
const linkRun = (source: string) => inlineRuns(source, registerHas).find((run) => run.kind !== "text") as InlineRun;
const NEW_TAB = { target: "_blank", rel: "noopener noreferrer" };
describe("inlineLinkElement", () => {
  it("makes a definition a button that opens a dialog", () => { expect(inlineLinkElement(linkRun("[product](def:product)"))).toEqual({ tag: "button", props: { className: "inline-link", "data-inline": "def", "data-inline-key": "product", type: "button", "aria-haspopup": "dialog" } }); });
  it("makes a tip a button described by its hidden words", () => { expect(inlineLinkElement(linkRun("a [Rango](tip:aango) knockoff"))).toEqual({ tag: "button", props: { className: "inline-link", "data-inline": "tip", "data-inline-key": "aango", "aria-describedby": "inline-desc-tip-aango", type: "button" } }); });
  it("makes a pop with an href a new-tab anchor, and one without a button", () => {
    expect(inlineLinkElement(linkRun("([or matcha](pop:matcha))"))).toEqual({ tag: "a", props: { className: "inline-link", "data-inline": "pop", "data-inline-key": "matcha", "aria-describedby": "inline-desc-pop-matcha", href: siteContent.register.pop.matcha.href, ...NEW_TAB } });
    expect(inlineLinkElement(linkRun("[bass clarinet](pop:contrabass-clarinet)"))?.tag).toBe("button");
  });
  it("makes an https link a new-tab anchor", () => { expect(inlineLinkElement(linkRun("[grab a time on my calendar](https://cal.com/aaron-sulbaran)"))).toEqual({ tag: "a", props: { className: "inline-link", "data-inline": "external", href: "https://cal.com/aaron-sulbaran", ...NEW_TAB } }); });
  it("names a link whose words are only a symbol, and no other", () => {
    expect(siteContent.inline.symbolLabel).toBe("Footnote");
    expect(inlineLinkElement(linkRun("building[*](tip:killer-drones)."))?.props["aria-label"]).toBe("Footnote");
    expect(inlineLinkElement(linkRun("[Rango](tip:aango)"))?.props["aria-label"]).toBeUndefined();
  });
  it("returns null for text", () => { expect(inlineLinkElement({ kind: "text", text: "plain", strong: false, em: false })).toBeNull(); });
});
describe("every string in siteContent", () => {
  it("renders exactly its visible words", () => { for (const leaf of walkStrings(siteContent)) expect(inlineRuns(leaf.text, registerHas).map((run) => run.text).join(""), leaf.path).toBe(visibleText(leaf.text)); });
});
