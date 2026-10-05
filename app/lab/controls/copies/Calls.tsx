"use client";

import type { CSSProperties } from "react";
import { siteContent } from "@/lib/content";
import { Fx, FxArrow } from "../Fx";
import type { ControlFill } from "../settings";

// The work modal's call to action (components/WorkModal.tsx) in a static
// modal panel, and two Connect rows (components/Connect.tsx). Today the call
// to action is a bare text link with a 16px arrow; here it becomes a 44px
// pill with a hairline ring so it can carry a fill. Connect rows keep their
// hairline, which the rise fill grows from.

const base = (px: number) => ({ "--base": `${px}px` }) as CSSProperties;
const item = siteContent.workItems[0];

export function WorkModalCopy({ fill }: { fill: ControlFill }) {
  const circle = fill.variant === "circle";
  return (
    <div className="flex w-full max-w-xl flex-col gap-6 rounded-2xl border border-border bg-background p-6 shadow-[var(--menu-shadow)] md:p-10">
      <div className="flex items-center gap-5">
        <div className="h-20 w-20 shrink-0 rounded-xl bg-glass shadow-[inset_0_0_0_1px_var(--color-border)]" />
        <div className="flex flex-col gap-1">
          <span className="text-sm text-muted">
            {item.role}, {item.year}
          </span>
          <h3 className="font-display text-3xl leading-tight text-foreground md:text-4xl">{item.title}</h3>
        </div>
      </div>
      <p className="text-base leading-relaxed text-foreground md:text-lg md:leading-[1.55]">{item.teaser}</p>
      <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
        <Fx
          as="a"
          variant={fill.variant}
          colorway={fill.colorway}
          origin="start"
          className="w-fit [box-shadow:inset_0_0_0_1px_var(--color-border)]"
          inner={`relative flex h-11 items-center gap-3 pl-5 ${circle ? "pr-1.5" : "pr-4"}`}
        >
          <span className="lab-label" style={base(18)}>
            {siteContent.work.cta}
          </span>
          <span data-fx-seed={circle ? "" : undefined} className={circle ? "fx-seed h-8 w-8" : "fx-seed"}>
            <FxArrow size={16} />
          </span>
        </Fx>
        <span className="text-sm text-muted">{siteContent.modals.closeHintKeyboard}</span>
      </div>
    </div>
  );
}

const LINKS = siteContent.connect.links.filter((link) => link.key === "linkedin" || link.key === "email-primary");

export function ConnectCopy({ fill }: { fill: ControlFill }) {
  const circle = fill.variant === "circle";
  return (
    <ul className="max-w-[720px]">
      {LINKS.map((link) => (
        <li key={link.key}>
          <Fx
            as="a"
            variant={fill.variant}
            colorway={fill.colorway}
            origin="start"
            shape="rect"
            line={1}
            lineInset={16}
            className={`-mx-4 ${fill.variant === "rise" ? "" : "[box-shadow:inset_0_-1px_0_var(--color-border)]"}`}
            inner="relative flex min-h-[56px] items-center gap-4 px-4 py-5"
          >
            <span className="lab-label w-28 shrink-0 md:w-32" style={base(14)}>
              {link.label}
            </span>
            <span className="flex-1 truncate font-display text-2xl text-foreground md:text-3xl">{link.value}</span>
            <span data-fx-seed={circle ? "" : undefined} className={circle ? "fx-seed -my-2 h-9 w-9" : "fx-seed"}>
              <FxArrow dir="up-right" size={20} />
            </span>
          </Fx>
        </li>
      ))}
    </ul>
  );
}
