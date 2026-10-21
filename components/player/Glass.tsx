import type { CSSProperties, ReactNode } from "react";
import { glass } from "@/components/soundtrack/PillParts";

// The glass surface the player sits on in the band and in the desktop pill
// (the pill's own glass: sanctioned backdrop blur, the soft shadow). The phone
// island brings its own black surface instead.
export function Glass({ radius = 22, className = "", style, children }: { radius?: number; className?: string; style?: CSSProperties; children: ReactNode }) {
  return (
    <div className={className} style={{ ...glass, borderRadius: radius, ...style }}>
      {children}
    </div>
  );
}
