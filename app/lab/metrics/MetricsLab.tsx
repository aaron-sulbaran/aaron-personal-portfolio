"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Reveal } from "@/components/Reveal";
import { revealIndex } from "@/lib/motion";
import { chartRange, MetricsBlock, MetricsStrip } from "./MetricsBlock";
import { Panel } from "./Panel";
import { Ribbon } from "./Ribbon";
import { VisitorQuestion } from "./VisitorQuestion";
import { ContributionsProvider } from "./context";
import type { ContributionData, ContributionWindow } from "./data";
import { activeDays, dateSpan, formatCount, isRolling, rangeTotal, sinceLabel, windowName, windowPeriod } from "./derive";
import { DAY_MS, dayMs, generateContributions } from "./skyline/maths";
import { DEFAULT_SETTINGS, type Settings } from "./settings";

// The lab shell: the real Up to now and Connect (rendered on the server and
// passed through) with the metrics placed between, in, or under them.

const STORAGE_KEY = "lab-metrics-v5";

function Kicker({ children }: { children: ReactNode }) {
  return (
    <div className="m-label reveal-item flex items-center gap-3 text-muted" style={revealIndex(0)}>
      <span className="inline-block h-px w-8 bg-border" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

function OwnSection({ children }: { children: ReactNode }) {
  return (
    <section aria-label="Building in public" className="relative w-full border-t border-border px-6 py-24 md:px-10 md:py-40">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mb-14 flex flex-col gap-6 md:mb-20 md:flex-row md:items-end md:justify-between">
          <Kicker>
            <span className="m-placeholder">On GitHub</span>
          </Kicker>
          <div className="md:max-w-[26ch]">
            <h2 className="reveal-mask font-display text-section" style={revealIndex(1)}>
              <span className="m-placeholder block">Building in public.</span>
            </h2>
            <p className="reveal-item mt-4 text-base leading-relaxed text-muted md:text-lg" style={revealIndex(2)}>
              <span className="m-placeholder">One square a day; the deeper the blue, the more I shipped.</span>
            </p>
          </div>
        </Reveal>
        {children}
      </div>
    </section>
  );
}

// Trims the real section's bottom padding so what follows reads as part of it.
function Continued({ section, children, className = "" }: { section: ReactNode; children: ReactNode; className?: string }) {
  return (
    <>
      <div className="[&>section]:!pb-0">{section}</div>
      <div className={"px-6 pb-24 md:px-10 md:pb-40 " + className}>{children}</div>
    </>
  );
}

type LabProps = { windows: Record<ContributionWindow, ContributionData>; upToNow: ReactNode; connect: ReactNode };

export function MetricsLab({ windows, upToNow, connect }: LabProps) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [pin, setPin] = useState<number | null>(null);
  const [replay, setReplay] = useState(0);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setSettings({ ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) });
    } catch {
      /* storage unavailable: start from the recommendation */
    }
  }, []);

  const update = (fn: (s: Settings) => Settings) =>
    setSettings((prev) => {
      const next = fn(prev);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable */
      }
      return next;
    });

  const s = settings;
  const block = <MetricsBlock settings={s} pin={pin} replay={replay} />;
  const question = s.question ? <VisitorQuestion /> : null;
  const data = windows[s.window];
  const name = windowName(data);
  const rolling = isRolling(data);
  const end = dayMs(data.fetched);
  // The same seed and span the skyline's own sample uses, so the two agree.
  const sampleDays = generateContributions(end, 7, Math.round((end - dayMs(data.range.from)) / DAY_MS) + 1);

  return (
    <ContributionsProvider data={data}>
    <div className="metrics-lab overflow-x-clip bg-background text-foreground">
      <Panel settings={s} onChange={update} pin={pin} onPin={setPin} onReplay={() => setReplay((r) => r + 1)} />

      <header className="px-6 pb-16 pt-32 md:px-10 md:pt-40">
        <div className="mx-auto max-w-6xl">
          <p className="m-label text-muted">Metrics lab, dev only</p>
          <h1 className="mt-4 font-display text-display-md">
            {rolling ? name.charAt(0).toUpperCase() + name.slice(1) : name} on GitHub, in context.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-[1.55] text-muted">
            The real Up to now and Connect sections with the metrics placed between them. The data is my contribution
            calendar, private work included, for {name}, {dateSpan(data.range.from, data.range.to, rolling)}:{" "}
            {formatCount(rangeTotal(data))} contributions on {activeDays(data)} days, the account dating from{" "}
            {sinceLabel(data)}. Copy with a dashed underline is placeholder. Scroll down.
          </p>
          <p className="m-label-sm mt-4 text-muted">Opens on Aaron&apos;s pick, 6 months, scroll morph; the panel holds the rest.</p>
        </div>
      </header>

      {s.placement === "section" && (
        <>
          {upToNow}
          <OwnSection>{block}</OwnSection>
          {question}
          {connect}
        </>
      )}

      {s.placement === "inside" && (
        <>
          <Continued section={upToNow} className="pt-28 md:pt-36">
            <div className="mx-auto max-w-6xl">{block}</div>
          </Continued>
          {question}
          {connect}
        </>
      )}

      {s.placement === "strip" && (
        <>
          {upToNow}
          {question}
          <Continued section={connect} className="pt-4 md:pt-6">
            <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-12 md:gap-16">
              <div className="md:col-span-7 md:col-start-6">
                <MetricsStrip settings={s} pin={pin} replay={replay} />
              </div>
            </div>
          </Continued>
        </>
      )}

      {s.placement === "divider" && (
        <>
          {upToNow}
          <div className="px-6 md:px-10">
            <div className="mx-auto max-w-6xl">
              <Ribbon
                key={[replay, s.data, s.window].join("-")}
                days={s.data === "real" ? data.days : sampleDays}
                endDate={data.fetched}
                range={chartRange(data, s)}
                share={s.share}
                period={windowPeriod(data)}
                caption={s.data === "real" ? "On GitHub since " + sinceLabel(data) : "Sample year, not my data"}
              />
            </div>
          </div>
          {question}
          {connect}
        </>
      )}

      <div className="h-[40vh]" aria-hidden="true" />
    </div>
    </ContributionsProvider>
  );
}
