"use client";

import { X } from "lucide-react";
import { Fill, FillArrow, FillSeed } from "@/components/fx/Fill";
import { quickCopy } from "@/lib/content/quick";
import { FILL_PICK } from "@/lib/fx/fill";
import { EXPRESS_PATH } from "@/lib/quick/transition";
import { useAppear } from "./useAppear";

// Mode A: the corner pill at the hero's bottom right, mirroring the Coil and
// Band toggle at its bottom left in the toggle's capsule (the Menu pill's
// glass, the hairline, the 8px blur over the live canvas) and the Coil
// control's fill and arrow. The link runs the transition; the x dismisses it
// for good. Below sm it reads "The MVP version" so it clears the toggle; the
// whole line stays its accessible name. Reduced motion: a fade, no rise.

const EXIT_MS = 220;
const { pill, pillName, dismiss } = quickCopy.invite;
const [lead, name] = [pill.slice(0, pill.indexOf(pillName)).trim(), pillName];

export function InvitePill({ shown, onGo, onDismiss }: { shown: boolean; onGo: () => void; onDismiss: () => void }) {
  const [mounted, on] = useAppear(shown, EXIT_MS);
  if (!mounted) return null;
  return (
    <div
      data-express-invite="pill"
      data-on={on ? "" : undefined}
      className="pointer-events-auto absolute bottom-[24px] right-[16px] z-[1] flex items-center gap-1 rounded-full bg-[var(--menu-pill)] p-1 opacity-0 backdrop-blur-[8px] transition-[opacity,transform] duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] [box-shadow:inset_0_0_0_1px_var(--color-border)] translate-y-2 data-[on]:translate-y-0 data-[on]:opacity-100 motion-reduce:translate-y-0 sm:right-[28px]"
    >
      <Fill
        as="a"
        href={EXPRESS_PATH}
        {...FILL_PICK.hero}
        onClick={(event) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
          event.preventDefault();
          onGo();
        }}
        data-cursor-hover
        className="flex min-h-8 items-center gap-2.5 whitespace-nowrap rounded-full pl-3 pr-0 font-label text-label leading-none text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-accent"
        overClassName="flex items-center gap-2.5 pl-3 pr-0"
      >
        <span>
          <span className="max-sm:sr-only">{lead} </span>
          {name}
        </span>
        <FillSeed className="h-8 w-8">
          <FillArrow />
        </FillSeed>
      </Fill>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={dismiss}
        data-cursor-hover
        className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors duration-200 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        <X aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
      </button>
    </div>
  );
}
