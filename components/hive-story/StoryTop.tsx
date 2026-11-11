import Image from "next/image";
import type { ReactNode } from "react";
import { hiveStoryCopy } from "@/lib/content/hive-story";
import { HIVE_SHOT_SIZES } from "@/lib/photoSizes";
import { HiveFlow } from "./Drawings";
import { FactTrip } from "./FactTrip";
import { FactTripPlayer } from "./FactTripPlayer";
import { SiteLink } from "./StoryBottom";

const { title, lede, framing, backLink, why, steps, team, status } = hiveStoryCopy;

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
      <p className="mt-3 max-w-[44rem] text-sm text-muted lg:text-[0.95rem]">
        {framing} <SiteLink href={backLink.href}>{backLink.label}</SiteLink>
      </p>
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

/** B's one-fact trip, the page's second section: the list of steps beside the trip drawn in bees, played in order. */
export function StepsSection() {
  return (
    <section aria-labelledby="hive-steps" className="hive-section hive-wrap">
      <SectionHeading id="hive-steps">{steps.heading}</SectionHeading>
      <FactTripPlayer>
        <div className="mt-8 grid gap-8 lg:mt-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start lg:gap-16">
          <div className="lg:order-2 lg:sticky lg:top-24">
            <FactTrip />
          </div>
          <ol className="grid gap-6 lg:order-1">
            {steps.items.map((step, i) => (
              <li key={step.title} data-step-item className="hive-step grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-3">
                <span aria-hidden="true" className="font-label text-label-lg tabular-nums">{i + 1}</span>
                <div className="min-w-0">
                  <h3 className="text-[1.0625rem] font-semibold leading-snug">{step.title}</h3>
                  <p className="mt-1 leading-[1.55] text-muted">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </FactTripPlayer>
      <p className="mt-10 max-w-[40rem] text-[1.0625rem]">{steps.proof}</p>
    </section>
  );
}

/** The team page's chosen look, as screenshots with a made-up team: the laptop view from 768 px up, and the phone view. */
export function TeamSection() {
  const { desktop, phone } = team.shots;
  return (
    <section aria-labelledby="hive-team" className="hive-section hive-wrap">
      <SectionHeading id="hive-team">{team.heading}</SectionHeading>
      <p className="mt-6 max-w-[44rem] text-[1.0625rem] leading-[1.6] lg:text-[1.15rem]">{team.body}</p>
      <div className="mt-10 flex items-end gap-6 lg:gap-8">
        <div className="hidden min-w-0 flex-1 md:block">
          <Image src={desktop.src} width={desktop.width} height={desktop.height} alt={desktop.alt} sizes={HIVE_SHOT_SIZES.desktop} className="hive-shot h-auto w-full rounded-[14px]" />
        </div>
        <div className="mx-auto w-full max-w-[320px] md:mx-0 md:w-[260px] md:flex-none">
          <Image src={phone.src} width={phone.width} height={phone.height} alt={phone.alt} sizes={HIVE_SHOT_SIZES.phone} className="hive-shot h-auto w-full rounded-[22px]" />
        </div>
      </div>
      <p className="mt-4 max-w-[40rem] text-sm text-muted">{team.note}</p>
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
