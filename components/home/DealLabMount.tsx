"use client";

import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";

// The deal's lab panel is a dev tool: the branch below is decided by
// NODE_ENV at build time, so a production build drops the import() and its
// chunk with it, and the panel is not in the output at all. The hero lab's
// frames (/lab/hero) load the home with ?embed=1, where the chip stays out of
// the way: the lab's own panel drives them.
const DealLab = process.env.NODE_ENV === "production" ? null : dynamic(() => import("./DealLab"), { ssr: false });

const noSubscription = () => () => {};
const isEmbedded = () => new URLSearchParams(window.location.search).get("embed") === "1";

export function DealLabMount() {
  const embedded = useSyncExternalStore(noSubscription, isEmbedded, () => false);
  return DealLab && !embedded ? <DealLab /> : null;
}
