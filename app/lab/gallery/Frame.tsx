"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { Frame as FrameSize } from "./GalleryContent";

// The viewport the modal opens in. "Window" fills the area beside the panel
// at 1x, so resizing the browser moves the real breakpoint; the named sizes
// are drawn at their true pixels and scaled to fit. The frame is transformed
// either way, which makes it the containing block for the modal's
// position:fixed, so the shell fills the frame, not the window.

export type FrameKey = "window" | "1440x900" | "1024x768" | "390x844" | "360x740";

export const FRAMES: Record<FrameKey, { label: string; size?: [number, number] }> = {
  window: { label: "This window" },
  "1440x900": { label: "1440 by 900", size: [1440, 900] },
  "1024x768": { label: "1024 by 768", size: [1024, 768] },
  "390x844": { label: "390 by 844", size: [390, 844] },
  "360x740": { label: "360 by 740", size: [360, 740] },
};

type Props = { frame: FrameKey; inset: string; children: (size: FrameSize) => ReactNode };

export function Frame({ frame, inset, children }: Props) {
  const areaRef = useRef<HTMLDivElement | null>(null);
  const [area, setArea] = useState<{ w: number; h: number } | null>(null);

  useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const read = () => setArea({ w: el.clientWidth, h: el.clientHeight });
    read();
    const observer = new ResizeObserver(read);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const fixed = FRAMES[frame].size;
  const pad = fixed ? 24 : 0;
  const size: FrameSize | null = area
    ? fixed
      ? { width: fixed[0], height: fixed[1], scale: Math.min(1, (area.w - 2 * pad) / fixed[0], (area.h - 2 * pad - 20) / fixed[1]) }
      : { width: area.w, height: area.h, scale: 1 }
    : null;

  return (
    <div ref={areaRef} className="fixed bottom-0 left-0 top-0 z-[46] overflow-hidden bg-[var(--menu-panel)]" style={{ right: inset }}>
      {size && (
        <div
          className="absolute"
          style={
            fixed
              ? { left: (area!.w - size.width * size.scale) / 2, top: pad + 20, width: size.width * size.scale, height: size.height * size.scale }
              : { inset: 0 }
          }
        >
          {fixed && (
            <p className="absolute -top-5 left-0 text-[11px] tabular-nums text-muted [font-family:system-ui]">
              {FRAMES[frame].label}, drawn at {Math.round(size.scale * 100)}%
            </p>
          )}
          <div
            data-lab-frame=""
            className="absolute left-0 top-0 overflow-hidden bg-background text-foreground [box-shadow:0_0_0_1px_var(--color-border)]"
            style={{ width: size.width, height: size.height, transform: `scale(${size.scale})`, transformOrigin: "0 0" }}
          >
            {children(size)}
          </div>
        </div>
      )}
    </div>
  );
}
