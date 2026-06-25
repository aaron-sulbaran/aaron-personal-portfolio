"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import { ScrollTrigger } from "@/lib/gsap";
import { Portal } from "./Portal";

// Ambient ASCII field: a quiet, low-contrast drift of monospace glyphs behind
// the back half, one atmospheric layer among several (never the focus). Body
// level via Portal so the pinned #hero-pin transform never captures this fixed
// canvas. Fully decoupled from the hero: a ScrollTrigger keyed to #work ramps
// the field in only once the journey begins, so it works the same whether the
// desktop ring pin or the mobile coverflow pin released, with zero edits to
// either. rAF only runs while the field is actually visible and the tab is
// foregrounded. Unmounted entirely under reduced motion.
//
// The canvas + its effect live in an inner component rendered INSIDE the Portal,
// so the effect runs only once the canvas is in the DOM (the Portal renders null
// until its own mount effect fires; an effect on the outer component would see a
// null ref and bail).

const GLYPHS = [".", "·", ":", "∙", "", "·", ".", "", "•", "", ".", ""];
const CELL_DESKTOP = 30; // px between glyph centers
const CELL_MOBILE = 46;
const FONT_DESKTOP = 12;
const FONT_MOBILE = 11;
const MAX_ALPHA = 0.32; // peak opacity of the muted glyph color
const DRIFT_AMP = 3.2; // px of ambient sway
const REPEL_RADIUS = 130; // px cursor influence
const REPEL_FORCE = 16; // px max push
const FRAME_MS = 33; // ~30fps; the drift is slow, so this is invisible and cheap

type Cell = { gx: number; gy: number; ch: string; phase: number };

export function AsciiField() {
  const reduce = useReducedMotion();
  if (reduce) return null;
  return (
    <Portal>
      <AsciiCanvas />
    </Portal>
  );
}

function AsciiCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    const fine = window.matchMedia("(pointer: fine)").matches;
    const cell = isMobile ? CELL_MOBILE : CELL_DESKTOP;
    const fontPx = isMobile ? FONT_MOBILE : FONT_DESKTOP;

    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let cols = 0;
    let rows = 0;
    let cells: Cell[] = [];
    let color = ""; // resolved from the --color-muted token (readColor) before first draw
    const cursor = { x: -9999, y: -9999 };

    let alpha = 0; // current global field alpha (lerps toward target)
    let alphaTarget = 0; // 0..1 from the #work scroll ramp
    let raf = 0;
    let last = 0;

    const readColor = () => {
      const v = getComputedStyle(document.documentElement)
        .getPropertyValue("--color-muted")
        .trim();
      if (v) color = v;
    };

    const build = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = `${fontPx}px ui-monospace, SFMono-Regular, Menlo, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      cols = Math.ceil(w / cell) + 1;
      rows = Math.ceil(h / cell) + 1;
      cells = [];
      for (let gy = 0; gy < rows; gy++) {
        for (let gx = 0; gx < cols; gx++) {
          const ch = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
          if (!ch) continue; // skip empties so the loop stays small
          cells.push({ gx, gy, ch, phase: Math.random() * Math.PI * 2 });
        }
      }
    };

    const draw = (t: number) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      ctx.clearRect(0, 0, w, h);
      if (alpha > 0.003 && color) {
        ctx.fillStyle = color;
        const time = t / 1000;
        for (const c of cells) {
          const bx = c.gx * cell;
          const by = c.gy * cell;
          let x = bx + Math.sin(time * 0.4 + c.gx * 0.5 + c.phase) * DRIFT_AMP;
          let y = by + Math.cos(time * 0.33 + c.gy * 0.5 + c.phase) * DRIFT_AMP;
          if (fine) {
            const dx = x - cursor.x;
            const dy = y - cursor.y;
            const dist = Math.hypot(dx, dy);
            if (dist < REPEL_RADIUS && dist > 0.01) {
              const push = (1 - dist / REPEL_RADIUS) * REPEL_FORCE;
              x += (dx / dist) * push;
              y += (dy / dist) * push;
            }
          }
          ctx.globalAlpha = alpha * MAX_ALPHA;
          ctx.fillText(c.ch, x, y);
        }
        ctx.globalAlpha = 1;
      }
    };

    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      if (t - last < FRAME_MS) return;
      last = t;
      alpha += (alphaTarget - alpha) * 0.08;
      if (alphaTarget < 0.003 && alpha < 0.004) {
        alpha = 0;
        draw(t);
        cancelAnimationFrame(raf);
        raf = 0;
        return;
      }
      draw(t);
    };

    const ensureRunning = () => {
      if (!raf && !document.hidden) {
        last = 0;
        raf = requestAnimationFrame(tick);
      }
    };

    readColor();
    build();

    // Scroll ramp keyed to #work. onUpdate handles gradual scrolling through the
    // range; the leave/enter handlers keep it correct on jumps (anchor clicks,
    // the spine's section jumps) that skip the range in one step.
    const work = document.getElementById("work");
    const st = work
      ? ScrollTrigger.create({
          trigger: work,
          start: "top bottom",
          end: "top center",
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            alphaTarget = self.progress;
            if (alphaTarget > 0.003) ensureRunning();
          },
          onEnter: ensureRunning,
          onEnterBack: ensureRunning,
          onLeave: () => {
            alphaTarget = 1; // past the ramp, going down: fully present
            ensureRunning();
          },
          onLeaveBack: () => {
            alphaTarget = 0; // above the ramp, back at the hero: fade out
          },
        })
      : null;

    // Deep reload (scroll recovery) may land us already past the ramp.
    if (work && work.getBoundingClientRect().top < window.innerHeight * 0.5) {
      alphaTarget = 1;
      ensureRunning();
    }

    const onMove = (e: PointerEvent) => {
      cursor.x = e.clientX;
      cursor.y = e.clientY;
    };
    const onResize = () => {
      readColor();
      build();
    };
    const onVisibility = () => {
      if (document.hidden) {
        if (raf) {
          cancelAnimationFrame(raf);
          raf = 0;
        }
      } else if (alphaTarget > 0.003) {
        ensureRunning();
      }
    };
    const themeObserver = new MutationObserver(readColor);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    if (fine) window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      st?.kill();
      themeObserver.disconnect();
      if (fine) window.removeEventListener("pointermove", onMove);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0"
    />
  );
}
