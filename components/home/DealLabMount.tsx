"use client";

import dynamic from "next/dynamic";

// The deal's lab panel is a dev tool: the branch below is decided by
// NODE_ENV at build time, so a production build drops the import() and its
// chunk with it, and the panel is not in the output at all.
const DealLab = process.env.NODE_ENV === "production" ? null : dynamic(() => import("./DealLab"), { ssr: false });

export function DealLabMount() {
  return DealLab ? <DealLab /> : null;
}
