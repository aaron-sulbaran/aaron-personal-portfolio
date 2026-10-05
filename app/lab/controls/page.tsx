import type { Metadata } from "next";
import { labFontVariables } from "../type/fonts";
import { ControlsLab } from "./ControlsLab";
import "./controls.css";

// /lab/controls: a dev-only bench for the fill hover on the site's buttons
// and a better soundtrack note. Static copies only; app/lab/layout.tsx 404s
// the route outside `pnpm dev`.
export const metadata: Metadata = { title: "Controls lab", robots: { index: false, follow: false } };

export default function ControlsLabPage() {
  return (
    <div id="main" className={labFontVariables}>
      <ControlsLab />
    </div>
  );
}
