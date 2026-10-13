"use client";

import { useEffect, useState } from "react";
import { quickCopy } from "@/lib/content/quick";

const ASKED_KEY = "aaron-rush-asked";

function remember() {
  try {
    localStorage.setItem(ASKED_KEY, "1");
  } catch {
    /* storage unavailable */
  }
}

function alreadyAsked(): boolean {
  try {
    return localStorage.getItem(ASKED_KEY) !== null;
  } catch {
    return true;
  }
}

// The label sits over the hero the whole time it is on screen. The toast
// asks once, four seconds after load, and never on a deep link, a long
// scroll, or reduced motion.
export function RushInvite() {
  const [hero, setHero] = useState(false);
  const [toast, setToast] = useState(false);

  useEffect(() => {
    const sentinel = document.querySelector("[data-hero-sentinel]");
    if (!sentinel) return;
    const observer = new IntersectionObserver(([entry]) => setHero(entry.isIntersecting));
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const deep = location.hash.length > 1 || window.scrollY > window.innerHeight * 0.5;
    if (reduce || deep || alreadyAsked()) return;
    let open = false;
    const show = window.setTimeout(() => {
      open = true;
      setToast(true);
    }, 4000);
    const dismiss = () => {
      window.clearTimeout(show);
      if (open) setToast(false);
      remember();
      window.removeEventListener("scroll", onScroll);
    };
    const onScroll = () => {
      if (window.scrollY > 40) dismiss();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.clearTimeout(show);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const stay = () => {
    setToast(false);
    remember();
  };

  return (
    <>
      {hero && (
        <a
          data-rush
          href="/quick"
          className="fixed bottom-24 left-1/2 z-20 -translate-x-1/2 rounded-full bg-glass-strong px-3 py-1 font-label text-label text-foreground"
        >
          {quickCopy.rushLink}
        </a>
      )}
      {toast && (
        <div data-rush className="fixed bottom-8 right-6 z-20 w-72 rounded-2xl bg-glass-strong p-4 text-foreground shadow-[var(--shadow-card)]">
          <p className="font-display text-xl">{quickCopy.rushTitle}</p>
          <p className="mt-1 text-sm text-muted">{quickCopy.rushBody}</p>
          <p className="mt-3 flex gap-2 font-label text-label">
            <a href="/quick" onClick={remember} className="rounded-full bg-accent px-3 py-1 text-background">{quickCopy.rushYes}</a>
            <button type="button" onClick={stay} className="rounded-full px-3 py-1 shadow-[inset_0_0_0_1px_var(--color-border)]">{quickCopy.rushNo}</button>
          </p>
        </div>
      )}
    </>
  );
}
