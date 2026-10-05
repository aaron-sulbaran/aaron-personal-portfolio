import type { Metadata } from "next";
import { labFontVariables } from "../type/fonts";
import { MarkLab } from "./MarkLab";

// /lab/mark: a dev-only bench for the mark's Easter egg, the strike that
// makes the A. app/lab/layout.tsx 404s the route outside `pnpm dev`.
export const metadata: Metadata = { title: "Mark lab", robots: { index: false, follow: false } };

export default function MarkLabPage() {
  return (
    <div id="main" className={labFontVariables}>
      <MarkLab />
    </div>
  );
}
