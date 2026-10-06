import type { Metadata } from "next";
import { UpToNow } from "@/components/UpToNow";
import { Connect } from "@/components/Connect";
import { labFontVariables } from "../type/fonts";
import { MetricsLab } from "./MetricsLab";
import { loadContributions } from "./data";
import "./metrics.css";

export const metadata: Metadata = { title: "Metrics lab", robots: { index: false, follow: false } };

// /lab/metrics: a GitHub contribution skyline in the site's own skin, placed
// around the real Up to now and Connect sections (Server Components, passed
// through the client shell as rendered children). The data comes through
// loadContributions() alone, once per window; the panel picks which one
// shows. Dev only via app/lab/layout.tsx.
export default async function MetricsLabPage() {
  const [rolling, year] = await Promise.all([loadContributions("12mo"), loadContributions("year")]);
  return (
    <div id="main" className={labFontVariables}>
      <MetricsLab windows={{ "12mo": rolling, year }} upToNow={<UpToNow />} connect={<Connect />} />
    </div>
  );
}
