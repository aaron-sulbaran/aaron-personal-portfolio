"use client";

import dynamic from "next/dynamic";

// The hero lab's bridge on the home page is a dev tool: the branch below is
// decided by NODE_ENV at build time, so a production build drops the import()
// and its chunk with it. It has no UI; it makes every dev load of the home
// follow the lab's saved knobs and its two replay buttons.
const IntroLabBridge = process.env.NODE_ENV === "production" ? null : dynamic(() => import("./IntroLabBridge"), { ssr: false });

export function HeroLabMount() {
  return IntroLabBridge ? <IntroLabBridge /> : null;
}
