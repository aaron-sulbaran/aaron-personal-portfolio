"use client";

import { useEffect, useState } from "react";
import { islandSpec, PHONE_PRESETS, type IslandSpec } from "@/lib/player/island";
import type { PhoneModel } from "@/lib/player/settings";

export interface IslandMetrics {
  spec: IslandSpec;
  insetTop: number; // env(safe-area-inset-top), px: 0 in a Safari tab, the full safe area when the page draws under the status bar
  viewportWidth: number;
}

// The inset can only be read through a probe that uses env().
function readInsetTop(): number {
  const probe = document.createElement("div");
  probe.style.cssText = "position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top, 0px)";
  document.body.appendChild(probe);
  const inset = parseFloat(getComputedStyle(probe).paddingTop) || 0;
  probe.remove();
  return inset;
}

function read(model: PhoneModel): IslandMetrics {
  const preset = model === "auto" ? null : PHONE_PRESETS[model];
  const screenSize = preset ?? { width: window.screen.width, height: window.screen.height };
  return { spec: islandSpec(screenSize, preset?.dpr ?? window.devicePixelRatio), insetTop: readInsetTop(), viewportWidth: window.innerWidth };
}

// Which phone this is and where the page ends and the status bar begins, read
// on the client (the island only ever mounts there) and again when the window
// turns. The lab's phone choice stands in for the screen in its preview frame.
export function useIslandSpec(model: PhoneModel): IslandMetrics {
  const [metrics, setMetrics] = useState(() => read(model));
  useEffect(() => {
    const update = () => setMetrics(read(model));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [model]);
  return metrics;
}
