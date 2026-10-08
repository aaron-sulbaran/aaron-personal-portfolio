import type { Metadata } from "next";
import { FooterLab } from "./FooterLab";
import "./footer.css";

// /lab/footer: a dev-only bench for the footer's "build.stuff" wordmark and
// the shader field ending in it. app/lab/layout.tsx 404s it outside `pnpm dev`.
export const metadata: Metadata = { title: "Footer lab", robots: { index: false, follow: false } };

export default function FooterLabPage() {
  return (
    <div id="main">
      <FooterLab />
    </div>
  );
}
