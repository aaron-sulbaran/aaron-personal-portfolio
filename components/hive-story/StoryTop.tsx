import type { ReactNode } from "react";
import { hiveStoryCopy } from "@/lib/content/hive-story";
import { DotGlyph, HiveFlow } from "./Drawings";

const { title, lede, framing, why, steps, status } = hiveStoryCopy;

export function SectionHeading({ id, children }: { id: string; children: ReactNode }) {
  return <h2 id={id} className="font-display text-[clamp(2rem,4.5vw,3.25rem)] leading-[1.05] tracking-[-0.02em] text-balance">{children}</h2>;
}

/** The first screen: who built it, what it is, and the whole flow in bees. */
export function StoryHero() {
  return (
    <header className="hive-wrap pt-24 md:pt-32">
      <div className="lg:grid lg:grid-cols-2 lg:items-end lg:gap-20">
        <h1 className="font-dot hive-title">{title}</h1>
        <p className="mt-3 max-w-[36rem] text-[1.0625rem] leading-[1.5] lg:mt-0 lg:text-[1.3rem]">{lede}</p>
      </div>
      <div className="mt-5 lg:mt-10">
        <HiveFlow />
      </div>
      <p className="mt-3 max-w-[40rem] text-sm text-muted lg:text-[0.95rem]">{framing}</p>
    </header>
  );
}

export function WhySection() {
  return (
    <section aria-labelledby="hive-why" className="hive-section hive-wrap">
      <SectionHeading id="hive-why">{why.heading}</SectionHeading>
      <div className="mt-6 grid max-w-[44rem] gap-4 text-[1.0625rem] leading-[1.6] lg:text-[1.15rem]">
        {why.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
      </div>
    </section>
  );
}

export function StepsSection() {
  return (
    <section aria-labelledby="hive-steps" className="hive-section hive-wrap">
      <SectionHeading id="hive-steps">{steps.heading}</SectionHeading>
      <ol className="mt-10 grid gap-x-10 gap-y-9 md:grid-cols-2 lg:grid-cols-3">
        {steps.items.map((step) => (
          <li key={step.title} className="grid grid-cols-[3.25rem_minmax(0,1fr)] gap-x-4">
            <DotGlyph glyph={step.glyph} className="mt-0.5 h-[3.25rem] w-[3.25rem]" />
            <div className="min-w-0">
              <h3 className="text-[1.0625rem] font-semibold leading-snug">{step.title}</h3>
              <p className="mt-1.5 leading-[1.55] text-muted">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-10 max-w-[40rem] text-[1.0625rem]">{steps.proof}</p>
    </section>
  );
}

function Marker({ next }: { next: boolean }) {
  return <span aria-hidden="true" className={`hive-marker ${next ? "hive-marker-next" : ""}`} />;
}

export function StatusSection() {
  const columns = [{ next: false, ...status.now }, { next: true, ...status.next }];
  return (
    <section aria-labelledby="hive-status" className="hive-section hive-wrap">
      <SectionHeading id="hive-status">{status.heading}</SectionHeading>
      <div className="mt-10 grid gap-12 lg:grid-cols-2 lg:gap-16">
        {columns.map((column) => (
          <div key={column.label}>
            <h3 className="flex items-center gap-3 font-label text-label-lg"><Marker next={column.next} />{column.label}</h3>
            <ul className="mt-5 grid gap-6">
              {column.items.map((item) => (
                <li key={item.title} className="grid grid-cols-[0.75rem_minmax(0,1fr)] gap-x-4">
                  <span className="pt-[0.45rem]"><Marker next={column.next} /></span>
                  <div className="min-w-0">
                    <p className="font-semibold">{item.title}</p>
                    <p className="mt-1 leading-[1.55]">{item.body}</p>
                    <p className="mt-1 leading-[1.55] text-muted">{item.why}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
