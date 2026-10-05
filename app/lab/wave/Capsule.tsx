import { NoteIcon } from "@/components/menu/NoteIcon";
import { siteContent } from "@/lib/content";
import { DOCK } from "@/lib/waveform/dock";

// A still placeholder of the music capsule where the dock puts it (bottom
// left, 24px in, 36px tall, centred on a line 72px above the viewport's
// bottom), so each composition is judged with the capsule in it. No motion;
// its arrival is the next lab.
export function Capsule() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed z-[45] flex items-center gap-2 rounded-full px-4 text-sm text-foreground"
      style={{
        left: DOCK.insetPx,
        bottom: DOCK.baselineFromBottomPx - DOCK.capsulePx / 2,
        height: DOCK.capsulePx,
        background: "var(--color-glass-strong)",
        border: "1px solid var(--color-border)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        boxShadow: "var(--pill-shadow)",
      }}
    >
      <NoteIcon on={false} className="h-[15px] w-[10px] text-muted" />
      <span>{siteContent.soundtrack.capsuleUnanswered}</span>
    </div>
  );
}
