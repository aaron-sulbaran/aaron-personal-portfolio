"use client";

import { useCloseHint } from "@/components/modal/useCloseHint";

export function CloseHint() {
  return <p className="font-label text-label text-muted">{useCloseHint()}</p>;
}
