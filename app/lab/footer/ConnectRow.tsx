"use client";

import { ArrowUpRight } from "lucide-react";
import { BrandIcon } from "@/components/BrandIcons";
import { lastUpdatedMonth } from "@/lib/buildDate";
import { FOOTER_COPY } from "./content";

// The tail of Connect as the approved file has it (the one big link, then the
// five logos, each swelling under the cursor with its handle), and the
// footer's small lines. `placement` puts it over the wordmark or under it.
export function ConnectRow({ placement }: { placement: "above" | "below" }) {
  const external = { target: "_blank", rel: "noopener noreferrer" } as const;
  return (
    <div
      className={`relative flex flex-col gap-8 md:flex-row md:items-end md:justify-between ${
        placement === "above" ? "pt-14 md:pt-20" : "border-t border-border pb-8 pt-6 md:pb-10"
      }`}
    >
      <div className="flex flex-col gap-5">
        {placement === "above" && (
          <a href={FOOTER_COPY.bookHref} {...external} className="group inline-flex items-baseline gap-2 font-display text-3xl text-foreground transition-colors hover:text-accent md:text-4xl">
            {FOOTER_COPY.bookLabel}
            <ArrowUpRight aria-hidden="true" className="h-6 w-6 translate-y-1 transition-transform group-hover:-translate-y-0 group-hover:translate-x-0.5" />
          </a>
        )}
        <ul className="flex items-center gap-2.5">
          {FOOTER_COPY.links.map((link) => (
            <li key={link.key} className="group relative">
              <a
                href={link.href}
                {...(link.key === "email" ? {} : external)}
                aria-label={`${link.label}, ${link.handle}`}
                className="flex h-10 w-10 items-center justify-center rounded-full text-foreground transition-[transform,color] duration-200 [box-shadow:inset_0_0_0_1px_var(--color-border)] hover:scale-[1.18] hover:text-accent"
              >
                <BrandIcon name={link.icon} className="h-[18px] w-[18px]" />
              </a>
              <span className="pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap text-[11px] text-muted opacity-0 transition-opacity group-hover:opacity-100">
                {link.handle}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-col gap-1 text-[12px] text-muted md:items-end">
        <p>{FOOTER_COPY.tagline(lastUpdatedMonth())}</p>
        <p className="tracking-wide">{FOOTER_COPY.copyright}</p>
      </div>
    </div>
  );
}
