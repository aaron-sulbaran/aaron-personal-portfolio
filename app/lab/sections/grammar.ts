import { gsap, ScrollTrigger } from "@/lib/gsap";
import { CustomEase } from "gsap/CustomEase";
import { SplitText } from "gsap/SplitText";
import type { EaseName, LabSettings, Reveal, SectionKey, SectionSettings } from "./settings";

// The grammar: one timeline and one ScrollTrigger per block. A block is a
// kicker, a heading, a body (lede or paragraph), one Up to now item, or the
// Connect link list. Scrubbed, each block's ScrollTrigger lags the real
// scroll by the shared lag plus a step per rank, so within a section the
// heading settles before the body; triggered once, the same timeline plays
// once with the lag as its duration. Everything is a from-tween on opacity,
// transform or filter: nothing is display or visibility, so the text is always
// in the accessibility tree, and the context revert restores it exactly.

let registered = false;
function ensurePlugins() {
  if (registered) return;
  gsap.registerPlugin(SplitText, CustomEase);
  CustomEase.create("sl-site", "0.22,1,0.36,1");
  registered = true;
}

const EASES: Record<EaseName, string> = {
  site: "sl-site",
  power2: "power2.out",
  power3: "power3.out",
  expo: "expo.out",
  sine: "sine.inOut",
  linear: "none",
};

// The live timelines, for the probe (window.__sectionsLab.probe()).
export const registry = new Map<HTMLElement, { section: SectionKey; kind: string; tl: gsap.core.Timeline }>();

interface Ctx {
  s: LabSettings;
  sec: SectionSettings;
  key: SectionKey;
  desktop: boolean;
}

const RANK: Record<string, number> = { kicker: 0, heading: 1, body: 2, links: 2, item: 2 };

// Blocks inside a sticky wrapper are measured from the wrapper's column, which
// never moves, plus their offset inside the wrapper, so a stuck heading can
// never shift its own trigger.
function anchorOf(el: HTMLElement): { trigger: HTMLElement; offset: () => number } {
  const wrapper = el.closest<HTMLElement>("[data-sl-sticky]");
  const col = wrapper?.parentElement;
  if (!wrapper || !col || wrapper.dataset.slSticky !== "on") return { trigger: el, offset: () => 0 };
  return { trigger: col, offset: () => (el === wrapper ? 0 : el.offsetParent === wrapper ? el.offsetTop : 0) };
}

function timelineFor(el: HTMLElement, kind: string, index: number, c: Ctx): { tl: gsap.core.Timeline; dur: number; lead: number } {
  const { s } = c;
  const rank = RANK[kind] ?? 2;
  const follows = kind !== "kicker" && kind !== "heading";
  const shift = follows ? s.follow : 0;
  const { trigger, offset } = anchorOf(el);
  const words = kind === "body" && bodyReveal(c) === "words";
  const start = () => `top+=${offset()} ${s.bandStart - shift}%`;
  const end = () => (words ? `bottom ${Math.max(5, s.bandEnd - 10)}%` : `top+=${offset()} ${s.bandEnd - shift}%`);
  const lag = s.lag + rank * s.lagStep + (kind === "item" ? index * s.up.itemLagStep : 0);
  const defaults = { ease: EASES[s.ease] };
  if (s.scrub) {
    const tl = gsap.timeline({
      defaults: { ...defaults, duration: 1 },
      scrollTrigger: { trigger, start, end, scrub: lag, invalidateOnRefresh: true },
    });
    return { tl, dur: 1, lead: 0 };
  }
  const dur = Math.max(0.45, s.lag);
  const lead = rank * s.lagStep + (kind === "item" ? index * s.up.itemLagStep : 0);
  const tl = gsap.timeline({
    defaults: { ...defaults, duration: dur },
    scrollTrigger: { trigger, start, toggleActions: "play none none none", once: true, invalidateOnRefresh: true },
  });
  return { tl, dur, lead };
}

function bodyReveal(c: Ctx): Reveal {
  // Phones keep the words in place: the read-along would compete with reading
  // on a small screen, as it does on the site today.
  return c.sec.body === "words" && !c.desktop ? "blur" : c.sec.body;
}

function fromState(reveal: Reveal, s: LabSettings): gsap.TweenVars {
  if (reveal === "mask") return { yPercent: 110 };
  if (reveal === "blur") return { opacity: 0, y: s.rise * 0.6, filter: `blur(${s.blur}px)` };
  return { opacity: 0, y: s.rise };
}

// A heading or body: whole, line by line (masked or not), or word by word.
function revealText(el: HTMLElement, kind: string, reveal: Reveal, c: Ctx) {
  if (reveal === "none") return;
  const byLine = (reveal === "mask" || reveal === "blur") && c.sec.split === "lines";
  if (reveal === "words" || byLine) {
    SplitText.create(el, {
      type: reveal === "words" ? "words" : "lines",
      mask: reveal === "mask" ? "lines" : undefined,
      linesClass: "sl-line",
      wordsClass: "sl-word",
      aria: "none",
      autoSplit: true,
      onSplit(self) {
        const { tl, dur, lead } = timelineFor(el, kind, 0, c);
        if (reveal === "words") {
          // The softness of the reading front, in words: more spread, a wider front.
          const front = 4 + c.s.spread * 16;
          tl.from(self.words, { opacity: c.s.dim, ease: "none", duration: dur, stagger: dur / front }, lead);
        } else {
          tl.from(self.lines, { ...fromState(reveal, c.s), stagger: dur * (1 - c.s.spread * 0.8) * 0.5 }, lead);
        }
        registry.set(el, { section: c.key, kind, tl });
        return tl;
      },
    });
    return;
  }
  const { tl, lead } = timelineFor(el, kind, 0, c);
  if (reveal === "mask") {
    gsap.set(el, { overflow: "clip", paddingBlock: "0.04em", marginBlock: "-0.04em" });
    const inner = el.querySelector<HTMLElement>("[data-sl-inner]") ?? el;
    tl.from(inner, fromState("mask", c.s), lead);
  } else {
    tl.from(el, fromState(reveal, c.s), lead);
  }
  registry.set(el, { section: c.key, kind, tl });
}

function revealKicker(el: HTMLElement, c: Ctx) {
  const rule = el.querySelector<HTMLElement>("[data-sl-rule]");
  const label = el.querySelector<HTMLElement>("[data-sl-label]");
  const draw = c.sec.ruleDraw && rule;
  if (!draw && c.sec.heading === "none") return;
  const { tl, dur, lead } = timelineFor(el, "kicker", 0, c);
  if (draw) tl.from(rule, { scaleX: 0, transformOrigin: "0% 50%" }, lead);
  if (label && c.sec.heading !== "none") {
    const vars = c.sec.heading === "blur" ? { opacity: 0, filter: `blur(${c.s.blur * 0.5}px)` } : { opacity: 0, x: -8 };
    tl.from(label, vars, lead + (draw ? dur * 0.45 : 0));
  }
  registry.set(el, { section: c.key, kind: "kicker", tl });
}

function revealItem(el: HTMLElement, index: number, c: Ctx) {
  const text = el.querySelector<HTMLElement>("[data-sl-text]");
  const hair = el.querySelector<HTMLElement>("[data-sl-hair]");
  if (!text) return;
  const { tl, dur, lead } = timelineFor(el, "item", index, c);
  const arrival = c.s.up.arrival;
  if (arrival === "hairline" && hair) {
    tl.from(hair, { scaleX: 0, transformOrigin: "0% 50%" }, lead);
    tl.from(text, { opacity: 0, y: c.s.rise }, lead + dur * 0.35);
  } else {
    tl.from(text, fromState(arrival === "blur" ? "blur" : "fade", c.s), lead);
  }
  registry.set(el, { section: c.key, kind: `item ${index}`, tl });
}

function revealLinks(el: HTMLElement, c: Ctx) {
  const rows = Array.from(el.querySelectorAll<HTMLElement>("[data-sl-row]"));
  const reveal = c.sec.body;
  if (!rows.length || (reveal === "none" && !c.s.connect.rowDraw)) return;
  const { tl, dur, lead } = timelineFor(el, "links", 0, c);
  const gap = dur * (1 - c.s.spread * 0.8) * 0.5;
  rows.forEach((row, i) => {
    const at = lead + i * gap;
    const hair = row.querySelector<HTMLElement>("[data-sl-hair]");
    const inner = row.querySelector<HTMLElement>("[data-sl-rowinner]");
    if (c.s.connect.rowDraw && hair) tl.from(hair, { scaleX: 0, transformOrigin: "0% 50%" }, at);
    if (inner && reveal !== "none") tl.from(inner, fromState(reveal === "words" ? "fade" : reveal, c.s), at + (c.s.connect.rowDraw ? dur * 0.25 : 0));
  });
  registry.set(el, { section: c.key, kind: "links", tl });
}

export function buildSection(root: HTMLElement, s: LabSettings, desktop: boolean) {
  ensurePlugins();
  const key = root.dataset.slSection as SectionKey;
  const c: Ctx = { s, sec: s.sections[key], key, desktop };
  root.querySelectorAll<HTMLElement>("[data-sl-block]").forEach((el) => {
    const kind = el.dataset.slBlock;
    if (kind === "kicker") revealKicker(el, c);
    else if (kind === "heading") revealText(el, "heading", c.sec.heading === "words" ? "fade" : c.sec.heading, c);
    else if (kind === "body") revealText(el, "body", bodyReveal(c), c);
    else if (kind === "item") revealItem(el, Number(el.dataset.slIndex ?? 0), c);
    else if (kind === "links") revealLinks(el, c);
  });
}

export function probe() {
  return Array.from(registry.values(), ({ section, kind, tl }) => ({
    section,
    kind,
    progress: Number(tl.progress().toFixed(3)),
    target: Number((tl.scrollTrigger?.progress ?? (tl.progress() > 0 ? 1 : 0)).toFixed(3)),
  }));
}

export { ScrollTrigger };
