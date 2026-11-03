import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CardEgg } from "@/components/card/CardEgg";
import { siteContent, type CardKey } from "@/lib/content";
import { galleryOf } from "@/lib/gallery/card";
import { cardSteps } from "@/lib/gallery/steps";
import { SUMMON_AFTER_MS, onMarkSummon } from "@/lib/mark/summon";

const keys = Object.keys(siteContent.cards) as CardKey[];
const shown = (cardKey: CardKey) => renderToStaticMarkup(CardEgg({ cardKey, onClose: () => {} }));

// The first element in a tree that has the prop (CardEgg holds no state, so it can be called as a function and its tree read).
function find(node: ReactNode, prop: string): ReactElement<Record<string, unknown>> | null {
  if (!isValidElement<Record<string, unknown>>(node)) return Array.isArray(node) ? node.map((child) => find(child, prop)).find(Boolean) ?? null : null;
  if (node.props[prop]) return node;
  return find(node.props.children as ReactNode, prop);
}

describe("This site's easter egg line", () => {
  it("is a standalone last line, then a link-styled Show me one, in my words", () => {
    expect(siteContent.cards["this-site"].modal.easterEgg).toEqual({ line: "I've hidden a few easter eggs on this site.", control: "Show me one" });
    const html = shown("this-site");
    expect(html).toContain("I&#x27;ve hidden a few easter eggs on this site. ");
    expect(html).toMatch(/<button type="button" class="inline-link card-link">Show me one<\/button>/);
    expect(html).toContain('data-mask="egg"');
  });

  it("is on This site alone, and only on a card with no photos, since the phone's pager does not draw it", () => {
    expect(keys.filter((key) => siteContent.cards[key].modal.easterEgg)).toEqual(["this-site"]);
    for (const key of keys.filter((k) => siteContent.cards[k].modal.easterEgg)) expect(galleryOf(key).photos).toHaveLength(0);
    for (const key of keys.filter((k) => k !== "this-site")) expect(shown(key), key).toBe("");
  });

  it("masks in after the words and before the links", () => {
    expect(cardSteps(galleryOf("this-site"), "rows", false).map((step) => step.map((part) => part.id))).toEqual([["title"], ["meta"], ["words-0"], ["egg"], ["links"]]);
    expect(cardSteps(galleryOf("talos"), "rows", false).flat().some((part) => part.id === "egg")).toBe(false);
  });
});

describe("Show me one", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("closes the card at once and asks the logo to play the egg once the card has gone", () => {
    const onClose = vi.fn();
    const played = vi.fn();
    const stop = onMarkSummon(played);
    const button = find(CardEgg({ cardKey: "this-site", onClose }), "onClick");
    (button!.props.onClick as () => void)();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(played).not.toHaveBeenCalled();
    vi.advanceTimersByTime(SUMMON_AFTER_MS);
    expect(played).toHaveBeenCalledTimes(1);
    stop();
  });
});
