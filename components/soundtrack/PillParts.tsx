import type { CSSProperties } from "react";
import { Play } from "lucide-react";
import type { SoundtrackState } from "@/lib/soundtrack";

// Shared pieces of the playback pill: the glass surface (backdrop blur is
// sanctioned on the pill), the cover tile, and the live glyph.

export const EASE = "var(--ease-out)";

export const glass: CSSProperties = {
  background: "var(--color-glass-strong)",
  border: "1px solid var(--color-border)",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
  boxShadow: "var(--pill-shadow)",
};

export const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export function iconButton(size?: number): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "transparent",
    border: size ? "1px solid var(--color-border)" : "none",
    borderRadius: size ? 999 : 0,
    width: size,
    height: size,
    padding: 0,
    color: size ? "var(--color-muted)" : "var(--color-foreground)",
    cursor: "pointer",
    flex: "0 0 auto",
  };
}

export function Cover({ size, cover }: { size: number; cover: string | null }) {
  return (
    <span
      style={{
        position: "relative",
        width: size,
        height: size,
        borderRadius: size >= 48 ? 12 : 10,
        overflow: "hidden",
        display: "block",
        flex: "0 0 auto",
        border: "1px solid var(--color-border)",
        background: "var(--color-glass)",
        backgroundImage: cover ? `url(${cover})` : undefined,
        backgroundSize: "cover",
      }}
    >
      {!cover && (
        <span
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: "repeating-linear-gradient(135deg, var(--color-border) 0 6px, transparent 6px 12px)",
            opacity: 0.6,
          }}
        />
      )}
    </span>
  );
}

// Mirrors the wave: playing bounces the bars, paused drops to a flat line.
export function Glyph({ music }: { music: SoundtrackState }) {
  if (music === "on") return <Equalizer />;
  if (music === "before")
    return (
      <span style={{ display: "flex", alignItems: "center", color: "var(--color-accent)" }}>
        <Play aria-hidden="true" size={13} fill="currentColor" />
      </span>
    );
  return (
    <span style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 14 }}>
      <span style={{ display: "block", width: 16, height: 2, borderRadius: 1, background: "var(--color-muted)", opacity: 0.7 }} />
    </span>
  );
}

const BARS = [
  { duration: 0.7, delay: 0, height: 0.7 },
  { duration: 1.0, delay: 0.18, height: 1 },
  { duration: 0.55, delay: 0.4, height: 0.5 },
  { duration: 0.85, delay: 0.12, height: 0.85 },
];

function Equalizer() {
  return (
    <span style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 14 }}>
      {BARS.map((bar, i) => (
        <span
          key={i}
          style={{
            display: "block",
            width: 2,
            height: 14 * bar.height,
            borderRadius: 2,
            background: "var(--color-accent)",
            transformOrigin: "bottom center",
            animation: `eqbar ${bar.duration}s ease-in-out infinite`,
            animationDelay: `${bar.delay}s`,
          }}
        />
      ))}
    </span>
  );
}
