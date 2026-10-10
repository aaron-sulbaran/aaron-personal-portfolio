"use client";

import { useEffect, useRef, useState, type ReactNode, type Ref } from "react";
import { canCreateWebGL2 } from "@/components/coil/webglProbe";
import { DRIFT_PRESETS, fieldClocks } from "@/lib/coil/drift";
import { FOOTER } from "@/lib/footer/constants";
import { FIELD_RING_WIDTH, fieldRings, type EggState } from "@/lib/footer/egg";
import { fieldDepths, fieldMaskImage, lettersRect, type FooterGeometry } from "@/lib/footer/geometry";
import { heroFrame } from "@/lib/footer/heroFrame";
import { readDocumentTokens } from "@/lib/footer/tokens";
import type { Theme } from "@/lib/theme";
import type { FooterFieldGl } from "./gl/footerFieldGl";
import { PosterField } from "./PosterField";

// The footer's field. Live: the hero's own field in raw WebGL 2, from a chunk
// (./gl) asked for when the footer comes within a viewport height of the
// screen, never under reduced motion and never when no WebGL 2 context can be
// made. Otherwise, and until the live field has drawn its first frame, the
// poster stand-in, framed the same way; a failed program or a lost context
// leaves the poster for the visit. A live field that stops being eligible
// (reduced motion switched on) unmounts, so coming back starts a fresh one
// behind the poster. Paused off screen; the theme's tokens are read once per
// theme; the canvas is sized from its container.

type Props = { text: string; geo: FooterGeometry; egg: EggState; reduced: boolean; theme: Theme };
type Tokens = ReturnType<typeof readDocumentTokens>;

function dprCap() {
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  return Math.min(window.devicePixelRatio || 1, coarse ? FOOTER.field.dprCap.coarse : FOOTER.field.dprCap.fine);
}

// The field's layer: the mask (the footer's share of the canvas, then the
// whole canvas under the word's top) and what is drawing.
function FieldLayer({ geo, live, children, layer }: { geo: FooterGeometry; live: boolean; children: ReactNode; layer?: Ref<HTMLDivElement> }) {
  const mask = fieldMaskImage(geo, fieldDepths(live).backdropShare);
  return (
    <div ref={layer} aria-hidden="true" data-footer-field={live ? "gl" : "poster"} className="pointer-events-none absolute inset-0" style={{ maskImage: mask, WebkitMaskImage: mask }}>
      {children}
    </div>
  );
}

export function FooterField({ text, geo, egg, reduced, theme }: Props) {
  const layer = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = layer.current;
    if (!el || near) return;
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setNear(true), { rootMargin: FOOTER.field.nearMargin });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);

  if (near && !reduced && !failed) return <LiveField text={text} geo={geo} egg={egg} theme={theme} onFail={() => setFailed(true)} />;
  return (
    <FieldLayer geo={geo} live={false} layer={layer}>
      <PosterField theme={theme} geo={geo} intensity={fieldDepths(false).canvas} still={reduced} />
    </FieldLayer>
  );
}

function LiveField({ text, geo, egg, theme, onFail }: Omit<Props, "reduced"> & { onFail: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [live, setLive] = useState(false);
  const scene = useRef<{ geo: FooterGeometry; letters: ReturnType<typeof lettersRect>; tokens: Tokens | null }>({ geo, letters: lettersRect(text, geo), tokens: null });
  const failRef = useRef(onFail);

  useEffect(() => {
    failRef.current = onFail;
    scene.current.geo = geo;
    scene.current.letters = lettersRect(text, geo);
  }, [onFail, text, geo]);

  useEffect(() => {
    scene.current.tokens = readDocumentTokens();
  }, [theme]);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    let cancelled = false;
    let field: FooterFieldGl | null = null;
    let stop = () => {};
    const fail = () => {
      if (!cancelled) failRef.current();
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
      let viewportH = window.innerHeight;
      const size = { w: c.clientWidth, h: c.clientHeight };
      f.resize(size.w, size.h, dprCap());
      const draw = (now: number) => {
        raf = 0;
        const s = scene.current;
        s.tokens ??= readDocumentTokens();
        const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
        last = now;
        elapsed += dt;
        const clocks = fieldClocks(elapsed, false, FOOTER.field.drift);
        const g = s.geo;
        const frame = heroFrame(size.w, size.h, viewportH, (g.wordTop + g.baselineY) / 2);
        f.draw({
          orange: clocks.orange,
          weather: clocks.weather,
          warp: DRIFT_PRESETS[FOOTER.field.drift].warp,
          tokens: s.tokens.field,
          name: s.tokens.name,
          aspect: frame.aspect,
          frameY: frame.frameY,
          frameY0: frame.frameY0,
          rings: fieldRings(egg.ripples, FOOTER.egg, now, g.size),
          ringWidthPx: FIELD_RING_WIDTH * g.size,
          behind: FOOTER.field.behind,
          letters: { ...s.letters, intensity: FOOTER.field.letters, surface: true },
          surfaceS: elapsed,
          viewportH,
        });
        if (first) {
          first = false;
          setLive(true);
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
        kick();
      });
      const io = new IntersectionObserver((entries) => {
        visible = entries[entries.length - 1].isIntersecting;
        if (visible) kick();
        else if (raf) {
          cancelAnimationFrame(raf);
          raf = 0;
        }
      });
      const onResize = () => {
        viewportH = window.innerHeight;
        kick();
      };
      ro.observe(c);
      io.observe(c);
      window.addEventListener("resize", onResize);
      c.addEventListener("webglcontextlost", fail);
      kick();
      return () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        io.disconnect();
        window.removeEventListener("resize", onResize);
        c.removeEventListener("webglcontextlost", fail);
      };
    };

    import("./gl/footerFieldGl").then(({ createFooterFieldGl }) => {
      if (cancelled) return;
      field = createFooterFieldGl(el);
      if (!field) return fail();
      stop = run(field, el);
    }, fail);
    return () => {
      cancelled = true;
      stop();
      field?.dispose();
    };
  }, [egg]);

  return (
    <FieldLayer geo={geo} live={live}>
      {!live && <PosterField theme={theme} geo={geo} intensity={fieldDepths(false).canvas} still={false} />}
      <canvas ref={canvas} data-footer-canvas className="absolute inset-0 h-full w-full" style={{ opacity: live ? 1 : 0 }} />
    </FieldLayer>
  );
}
