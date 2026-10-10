"use client";

import { useEffect, useRef, useState } from "react";
import { FOOTER } from "@/lib/footer/constants";
import type { FooterGeometry } from "@/lib/footer/geometry";
import { posterBox, recolor } from "@/lib/footer/heroFrame";
import { readDocumentTokens } from "@/lib/footer/tokens";
import type { Theme } from "@/lib/theme";

// The poster stand-in: the hero's poster (public/coil/field-{theme}.avif, the
// live field's first frame on the hero's drift) framed as the live field is
// (the hero's frame, its middle on the word's middle), recolored to a depth
// from the paper, and drifted by CSS (globals.css .footer-drift). Still under
// reduced motion; paused off screen. It is what the footer shows until the
// live field draws, and whenever the live field cannot run.

type Props = { theme: Theme; geo: FooterGeometry; intensity: number; still: boolean };

export function PosterField({ theme, geo, intensity, still }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [onScreen, setOnScreen] = useState(false);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => setOnScreen(entries[entries.length - 1].isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d", { willReadFrequently: true });
    if (!el || !ctx) return;
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (cancelled || !image.naturalWidth) return;
      const scale = FOOTER.poster.width / Math.max(1, geo.stageW);
      el.width = FOOTER.poster.width;
      el.height = Math.max(1, Math.round(geo.stageH * scale));
      const midY = ((geo.wordTop + geo.baselineY) / 2) * scale;
      const box = posterBox(el.width, el.height, image.naturalWidth, image.naturalHeight, window.innerHeight * scale, midY);
      ctx.clearRect(0, 0, el.width, el.height);
      ctx.drawImage(image, box.x, box.y, box.w, box.h);
      if (intensity !== 1) {
        const data = ctx.getImageData(0, 0, el.width, el.height);
        recolor(data.data, readDocumentTokens().field.paper, intensity);
        ctx.putImageData(data, 0, 0);
      }
      el.dataset.drawn = theme;
    };
    image.src = `/coil/field-${theme}.avif`;
    return () => {
      cancelled = true;
      image.onload = null;
    };
  }, [theme, geo, intensity]);

  return (
    <canvas
      ref={canvas}
      data-footer-poster
      className="footer-drift absolute inset-0 h-full w-full"
      style={{ animationDuration: `${FOOTER.poster.driftS}s`, animationPlayState: still || !onScreen ? "paused" : "running" }}
    />
  );
}
