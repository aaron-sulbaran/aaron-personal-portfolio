import { siteContent } from "@/lib/content";
import type { InlineRun } from "@/lib/content/links";

export type TipKind = "tip" | "pop";

// The hidden element (components/inline/InlineLayer) whose words describe a
// tip or pop link through aria-describedby.
export const descriptionId = (kind: TipKind, key: string): string => `inline-desc-${kind}-${key}`;

export interface InlineLinkProps {
  className: "inline-link";
  "data-inline": "def" | "tip" | "pop" | "external";
  "data-inline-key"?: string;
  type?: "button";
  href?: string;
  target?: "_blank";
  rel?: "noopener noreferrer";
  "aria-haspopup"?: "dialog";
  "aria-describedby"?: string;
  "aria-label"?: string;
}

export interface InlineLinkElement {
  tag: "a" | "button";
  props: InlineLinkProps;
}

const NO_WORDS = /^[^\p{L}\p{N}]+$/u;

// What a link run renders as: native elements only, marked for the delegated
// layer. A pop with an href is an anchor, so a click and Enter follow it.
export function inlineLinkElement(run: InlineRun): InlineLinkElement | null {
  if (run.kind === "text") return null;
  const named: Pick<InlineLinkProps, "aria-label"> = NO_WORDS.test(run.text)
    ? { "aria-label": siteContent.inline.symbolLabel }
    : {};
  if (run.kind === "external") {
    return {
      tag: "a",
      props: { className: "inline-link", "data-inline": "external", href: run.href, target: "_blank", rel: "noopener noreferrer", ...named },
    };
  }
  const base: InlineLinkProps = { className: "inline-link", "data-inline": run.kind, "data-inline-key": run.key, ...named };
  if (run.kind === "def") return { tag: "button", props: { ...base, type: "button", "aria-haspopup": "dialog" } };
  const described: InlineLinkProps = { ...base, "aria-describedby": descriptionId(run.kind, run.key) };
  const href = run.kind === "pop" ? siteContent.register.pop[run.key]?.href : undefined;
  if (href) return { tag: "a", props: { ...described, href, target: "_blank", rel: "noopener noreferrer" } };
  return { tag: "button", props: { ...described, type: "button" } };
}
