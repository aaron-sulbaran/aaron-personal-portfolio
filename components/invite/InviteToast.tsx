"use client";

import { quickCopy } from "@/lib/content/quick";
import { Portal } from "@/components/Portal";
import { useAppear } from "./useAppear";

// Mode C: the toast at the bottom right, its title, one line, "Show me" and
// "I'll explore". raised: the pill holds the corner, so the toast stands above
// it. z-[34]: over the page's bar (30), under the Menu's scrim (35), so an
// open Menu covers it. Reduced motion: a fade, no slide.

const EXIT_MS = 240;
const { toastTitle, toastBody, yes, no } = quickCopy.invite;

export function InviteToast({ shown, raised, onGo, onDismiss }: { shown: boolean; raised: boolean; onGo: () => void; onDismiss: () => void }) {
  const [mounted, on] = useAppear(shown, EXIT_MS);
  if (!mounted) return null;
  return (
    <Portal>
      <div
        role="region"
        aria-label={toastTitle}
        data-express-invite="toast"
        data-on={on ? "" : undefined}
        className={`fixed right-4 z-[34] w-[min(20rem,calc(100vw-2rem))] translate-x-6 rounded-2xl bg-glass-strong p-4 text-foreground opacity-0 backdrop-blur-md transition-[opacity,transform,bottom] duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] [box-shadow:inset_0_0_0_1px_var(--color-border),var(--shadow-card)] data-[on]:translate-x-0 data-[on]:opacity-100 motion-reduce:translate-x-0 sm:right-[28px] ${raised ? "bottom-[80px]" : "bottom-6"}`}
      >
        <p className="font-display text-xl leading-tight">{toastTitle}</p>
        <p className="mt-1 text-sm leading-snug text-muted">{toastBody}</p>
        <p className="mt-3 flex gap-2 font-label text-label">
          <button type="button" onClick={onGo} data-cursor-hover className="rounded-full bg-accent px-3.5 py-1.5 text-background transition-colors hover:bg-accent-hover">
            {yes}
          </button>
          <button type="button" onClick={onDismiss} data-cursor-hover className="rounded-full px-3.5 py-1.5 text-foreground transition-colors [box-shadow:inset_0_0_0_1px_var(--color-border)] hover:text-accent">
            {no}
          </button>
        </p>
      </div>
    </Portal>
  );
}
