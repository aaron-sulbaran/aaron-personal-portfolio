"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { siteContent } from "@/lib/content";
import type { LetterContrast } from "@/lib/coil/letterContrast";
import type { DebugStats } from "./scene/debug";

// QA only, with ?coildebug=name: the name's wake grid drawn over the hero
// (each cell's wake as the accent's alpha) and a readout of each letter's
// contrast against the field (lib/coil/letterContrast.ts), its spread and the
// tonal range inside the letters. Production never mounts it.

const noSubscribe = () => () => {};
function readDebugName() {
  const value = new URLSearchParams(window.location.search).get("coildebug");
  return value ? value.split(",").some((token) => token.trim() === "name") : false;
}

type Readout = { contrast: LetterContrast | null; wakeMax: number };

const fmt = (x: number) => (Number.isFinite(x) ? (x >= 0 ? "+" : "") + x.toFixed(3) : "n/a");

export function NameReadout() {
  const on = useSyncExternalStore(noSubscribe, readDebugName, () => false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [readout, setReadout] = useState<Readout | null>(null);

  useEffect(() => {
    if (!on) return;
    const coil = () => (window as unknown as { __coil?: DebugStats }).__coil;
    const accent = getComputedStyle(document.documentElement).getPropertyValue("--color-accent").trim();
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const canvas = canvasRef.current;
      const grid = coil()?.nameWake?.();
      const g = canvas?.getContext("2d");
      if (!canvas || !g || !grid) return;
      const box = canvas.getBoundingClientRect();
      if (canvas.width !== Math.round(box.width) || canvas.height !== Math.round(box.height)) {
        canvas.width = Math.round(box.width);
        canvas.height = Math.round(box.height);
      }
      g.clearRect(0, 0, canvas.width, canvas.height);
      const cw = grid.rect.w / grid.cols;
      const ch = grid.rect.h / grid.rows;
      g.fillStyle = accent;
      for (let r = 0; r < grid.rows; r++) {
        for (let c = 0; c < grid.cols; c++) {
          const e = grid.wake[r * grid.cols + c];
          if (e <= 0.004) continue;
          g.globalAlpha = Math.min(0.85, e * 1.6);
          g.fillRect(grid.rect.x + c * cw + 1, grid.rect.y + r * ch + 1, cw - 2, ch - 2);
        }
      }
      g.globalAlpha = 0.5;
      g.strokeStyle = accent;
      g.strokeRect(grid.rect.x + 0.5, grid.rect.y + 0.5, grid.rect.w - 1, grid.rect.h - 1);
      g.globalAlpha = 1;
    };
    raf = requestAnimationFrame(draw);
    // The readout reads the frame back, so once a second is plenty.
    const tick = () => {
      const stats = coil();
      if (!stats?.nameProbe || !stats.nameFx) return;
      setReadout({ contrast: stats.nameProbe.contrast(), wakeMax: stats.nameFx().wakeMax });
    };
    const interval = window.setInterval(tick, 1000);
    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(interval);
    };
  }, [on]);

  if (!on) return null;
  const copy = siteContent.hero.nameReadout;
  const c = readout?.contrast;
  const letters = [...siteContent.hero.name];
  return (
    <>
      <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" />
      <div
        role="group"
        aria-label={copy.label}
        className="pointer-events-auto absolute bottom-4 left-4 z-10 flex flex-col gap-1 rounded-lg border border-border bg-background px-3 py-2 font-sans text-[12px] leading-snug text-foreground tabular-nums"
      >
        <span>
          {copy.letters}{" "}
          {c ? letters.map((letter, i) => `${letter} ${fmt(c.letters[i] ?? Number.NaN)}`).join("  ") : "n/a"}
        </span>
        <span>
          {copy.spread} {c ? `${c.spread.toFixed(2)}x` : "n/a"}, {copy.range} {c ? c.rangeP5P95.toFixed(3) : "n/a"}, {copy.greeting}{" "}
          {c ? fmt(c.greetDL) : "n/a"}
        </span>
        <span>
          {copy.wake} {readout ? readout.wakeMax.toFixed(3) : "n/a"}
        </span>
      </div>
    </>
  );
}
