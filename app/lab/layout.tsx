import { notFound } from "next/navigation";
import type { ReactNode } from "react";

// Lab pages are hand-tuning surfaces for Aaron, never shipped. They live on
// the `lab` branch only and 404 outside `pnpm dev`.
export default function LabLayout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV !== "development") notFound();
  return children;
}
