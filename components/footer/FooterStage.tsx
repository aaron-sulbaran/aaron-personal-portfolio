"use client";

import type { ReactNode } from "react";
import { bandShare } from "@/lib/footer/geometry";

// The footer's client part (slice C6), around the server's small lines
// (children). The word's band is reserved in cqw (the footer is an
// inline-size container) at the height the wordmark lays out, so the server's
// footer already has its final height. The wordmark mounts here in Task 8
// and the field in Task 9.

type Props = { text: string; children: ReactNode };

export function FooterStage({ text, children }: Props) {
  return (
    <footer data-footer className="relative isolate w-full overflow-hidden bg-background [container-type:inline-size]">
      {children}
      <div aria-hidden="true" data-footer-band style={{ height: `${(bandShare(text) * 100).toFixed(4)}cqw` }} />
    </footer>
  );
}
