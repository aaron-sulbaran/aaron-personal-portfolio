import type { Metadata } from "next";
import { lastUpdatedMonth } from "@/lib/buildDate";
import { labFontVariables } from "./fonts";
import { TypeLab } from "./TypeLab";
import "./lab.css";

// /lab/type: a dev-only bench for choosing the label face (the small
// non-body text beside Profa Black). The candidates load here and nowhere
// else; app/lab/layout.tsx 404s the route outside `pnpm dev`.
export const metadata: Metadata = { title: "Type lab", robots: { index: false, follow: false } };

export default function TypeLabPage() {
  return (
    <div id="main" className={labFontVariables}>
      <TypeLab month={lastUpdatedMonth()} />
    </div>
  );
}
