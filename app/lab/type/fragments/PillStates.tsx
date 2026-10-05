import type { CSSProperties, ReactNode } from "react";
import { NoteIcon } from "@/components/menu/NoteIcon";
import { siteContent } from "@/lib/content";
import { role } from "../Specimen";

// components/soundtrack/PlaybackPill.tsx, PillLabel.tsx and PillParts.tsx,
// static: the capsule in each state it rests in, the landing label, and the
// hover preview with its tip. The site sets these sizes inline; here they are
// classes so the lab can restyle them. No audio, no store, no dock.
const s = siteContent.soundtrack;
const track = s.tracks[0];

const glass: CSSProperties = {
  background: "var(--color-glass-strong)",
  border: "1px solid var(--color-border)",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
  boxShadow: "var(--pill-shadow)",
};

type Music = "before" | "on" | "paused";

function Glyph({ music }: { music: Music }) {
  return (
    <span className="lab-icon flex h-4 w-4 flex-none items-center justify-center">
      {music === "paused" ? (
        <span className="block h-0.5 w-4 rounded-[1px] bg-muted opacity-70" />
      ) : (
        <NoteIcon on={music === "on"} className={`block h-[15px] w-[9.5px] ${music === "on" ? "text-accent" : "text-muted"}`} />
      )}
    </span>
  );
}

function Capsule({ music, preview = false, children }: { music: Music; preview?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      className="flex min-h-9 items-center rounded-full font-sans text-foreground"
      style={{ ...glass, padding: preview ? "8px 16px 8px 8px" : "0 16px 0 13px" }}
    >
      {preview ? children : <Glyph music={music} />}
      {preview ? <Glyph music={music} /> : <span style={{ paddingLeft: "var(--lab-icon-gap, 8px)" }}>{children}</span>}
    </button>
  );
}

function Cover() {
  return (
    <span className="relative block h-[38px] w-[38px] flex-none overflow-hidden rounded-[10px] border border-border bg-glass">
      <span
        className="absolute inset-0 opacity-60"
        style={{ backgroundImage: "repeating-linear-gradient(135deg, var(--color-border) 0 6px, transparent 6px 12px)" }}
      />
    </span>
  );
}

function Caption({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-[11px] text-muted [font-family:system-ui]">{children}</p>;
}

export function PillStates() {
  const tip = role("pill", 11);
  return (
    <div className="flex flex-wrap items-end gap-x-10 gap-y-12">
      <div>
        <Capsule music="before">
          <span className="whitespace-nowrap text-[12px] font-medium text-muted" {...role("pill", 12, true)}>
            {s.capsuleUnanswered}
          </span>
        </Capsule>
        <Caption>Before a choice</Caption>
      </div>
      <div>
        <Capsule music="on">
          <span className="whitespace-nowrap text-[12px] font-medium text-foreground" {...role("pill", 12, true)}>
            {s.dockAccepted}
          </span>
        </Capsule>
        <Caption>Landing label</Caption>
      </div>
      <div>
        <Capsule music="on">
          <span className="whitespace-nowrap text-[12px] font-medium text-foreground" {...role("pill", 12, true)}>
            {track.title}
          </span>
        </Capsule>
        <Caption>Playing</Caption>
      </div>
      <div>
        <Capsule music="paused">
          <span className="whitespace-nowrap text-[12px] font-medium text-muted" {...role("pill", 12, true)}>
            {s.capsulePaused}
          </span>
        </Capsule>
        <Caption>Paused</Caption>
      </div>
      <div className="relative pt-10">
        <div
          aria-hidden="true"
          className="absolute left-0 top-0 whitespace-nowrap rounded-full text-[11px] text-muted"
          data-role={tip["data-role"]}
          style={{ ...glass, padding: "6px 11px", ...tip.style }}
        >
          {s.prompt}
        </div>
        <Capsule music="on" preview>
          <Cover />
          <span className="block whitespace-nowrap px-3">
            <span className="block text-[12px] font-medium" {...role("pill", 12, true)}>
              {track.title}
            </span>
            <span className="block text-[11px] text-muted" {...role("pill", 11)}>
              {track.artist}
            </span>
          </span>
        </Capsule>
        <Caption>Hover preview and tip</Caption>
      </div>
    </div>
  );
}
