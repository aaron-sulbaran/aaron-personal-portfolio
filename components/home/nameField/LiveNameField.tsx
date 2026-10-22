"use client";

import { useEffect, useRef } from "react";
import { canCreateWebGL2 } from "@/components/coil/webglProbe";
import type { FooterFieldGl } from "@/components/footer/gl/footerFieldGl";
import { COIL } from "@/lib/coil/constants";
import { DEFAULT_DRIFT, DRIFT_PRESETS, fieldClocks } from "@/lib/coil/drift";
import { FOOTER } from "@/lib/footer/constants";
import { readDocumentTokens } from "@/lib/footer/tokens";
import { getIntroKnobs } from "@/lib/home/introKnobs";
import { fieldFrame, type NameFieldMask } from "@/lib/home/nameField";
import type { Theme } from "@/lib/theme";
import type { StageBox } from "./useStageBox";

// The name's live field: the footer's raw WebGL field (its chunk, asked for
// with import()) with its radial alpha mask, drawn over the stage with no
// letters (the heading is DOM text on top). The hero's own drift; the
// burnt orange lobe scaled by the lab's orangeAmount; the field's frame is the
// slice of the hero's field the stage shows (lib/home/nameField.ts). It runs
// only while on screen, and the tokens are read once per theme. A failed
// context, program or chunk calls onFail and the poster carries on.

type Props = {
  box: StageBox;
  mask: NameFieldMask;
  theme: Theme;
  onFirstFrame: () => void;
  onFail: () => void;
};

function dprCap() {
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  return Math.min(window.devicePixelRatio || 1, coarse ? FOOTER.field.dprCap.coarse : FOOTER.field.dprCap.fine);
}

const NO_LETTERS = { band: -1, rect: { x: 0, y: 0, w: 1, h: 1 }, intensity: 0, surface: false } as const;

export function LiveNameField({ box, mask, theme, onFirstFrame, onFail }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const latest = useRef({ box, mask, tokens: null as ReturnType<typeof readDocumentTokens> | null });
  const callbacks = useRef({ onFirstFrame, onFail });

  useEffect(() => {
    latest.current.box = box;
    latest.current.mask = mask;
    callbacks.current = { onFirstFrame, onFail };
  }, [box, mask, onFirstFrame, onFail]);

  useEffect(() => {
    latest.current.tokens = readDocumentTokens();
  }, [theme]);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    let cancelled = false;
    let field: FooterFieldGl | null = null;
    let stop = () => {};
    const fail = () => {
      if (!cancelled) callbacks.current.onFail();
    };
    if (!canCreateWebGL2()) {
      const id = requestAnimationFrame(fail);
      return () => {
        cancelled = true;
        cancelAnimationFrame(id);
      };
    }

    const run = (f: FooterFieldGl, c: HTMLCanvasElement) => {
      let raf = 0;
      let visible = true;
      let first = true;
      let last = performance.now();
      let elapsed = 0; // the field's clock, s: it runs only while drawn, as the hero's does
      const size = { w: c.clientWidth, h: c.clientHeight };
      f.resize(size.w, size.h, dprCap());
      const draw = (now: number) => {
        raf = 0;
        const s = latest.current;
        s.tokens ??= readDocumentTokens();
        elapsed += Math.min(0.1, Math.max(0, (now - last) / 1000));
        last = now;
        const clocks = fieldClocks(elapsed, false, DEFAULT_DRIFT);
        const frame = fieldFrame(s.box.stage, s.box.viewportH, COIL.intro.field.frameAt);
        f.draw({
          orange: clocks.orange,
          weather: clocks.weather,
          warp: DRIFT_PRESETS[DEFAULT_DRIFT].warp,
          tokens: s.tokens.field,
          name: s.tokens.name,
          aspect: frame.aspect,
          frameY: frame.frameY,
          frameY0: frame.frameY0,
          rings: [],
          ringWidthPx: 1,
          behind: 1,
          letters: NO_LETTERS,
          surfaceS: 0,
          viewportH: s.box.viewportH,
          mask: s.mask,
          orangeScale: getIntroKnobs().orangeAmount,
        });
        if (first) {
          first = false;
          callbacks.current.onFirstFrame();
        }
        if (visible) raf = requestAnimationFrame(draw);
      };
      const kick = () => {
        if (!visible || raf) return;
        last = performance.now();
        raf = requestAnimationFrame(draw);
      };
      const ro = new ResizeObserver(([entry]) => {
        size.w = entry.contentRect.width;
        size.h = entry.contentRect.height;
        f.resize(size.w, size.h, dprCap());
        // A new size clears the buffer: drawn now, before the paint, even off screen.
        cancelAnimationFrame(raf);
        draw(performance.now());
      });
      const io = new IntersectionObserver((entries) => {
        visible = entries[entries.length - 1].isIntersecting;
        if (visible) kick();
        else if (raf) {
          cancelAnimationFrame(raf);
          raf = 0;
        }
      });
      ro.observe(c);
      io.observe(c);
      c.addEventListener("webglcontextlost", fail);
      kick();
      return () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        io.disconnect();
        c.removeEventListener("webglcontextlost", fail);
      };
    };

    import("@/components/footer/gl/footerFieldGl")
      .then(({ createFooterFieldGl }) => {
        if (cancelled) return;
        field = createFooterFieldGl(el, { alpha: true });
        if (!field) return fail();
        stop = run(field, el);
      })
      .catch(fail);
    return () => {
      cancelled = true;
      stop();
      field?.dispose();
    };
  }, []);

  return <canvas ref={canvas} data-name-canvas="" className="absolute inset-0 h-full w-full" />;
}
