import Link from "next/link";
import { hiveStoryCopy } from "@/lib/content/hive-story";
import { ScenarioSwarm } from "./Drawings";
import { SectionHeading } from "./StoryTop";

const { scenarios, calls, numbers, more, framing } = hiveStoryCopy;

export function ScenariosSection() {
  return (
    <section aria-labelledby="hive-scenarios" className="hive-section hive-wrap">
      <SectionHeading id="hive-scenarios">{scenarios.heading}</SectionHeading>
      <p className="mt-4 max-w-[40rem] text-[1.0625rem] leading-[1.55]">{scenarios.intro}</p>
      <ul className="mt-10 grid gap-8 md:grid-cols-3 md:gap-6">
        {scenarios.items.map((item) => (
          <li key={item.key} className="min-w-0">
            <div className="rounded-[18px] bg-[var(--hive-honey)] p-3"><ScenarioSwarm scenario={item.key} /></div>
            <h3 className="mt-4 text-[1.0625rem] font-semibold">{item.title}</h3>
            <p className="mt-1.5 leading-[1.55] text-muted">{item.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function CallsSection() {
  return (
    <section aria-labelledby="hive-calls" className="hive-section hive-wrap">
      <SectionHeading id="hive-calls">{calls.heading}</SectionHeading>
      <dl className="mt-10 grid gap-x-16 gap-y-7 lg:grid-cols-2">
        {calls.items.map((item) => (
          <div key={item.title} className="min-w-0">
            <dt className="font-semibold">{item.title}</dt>
            <dd className="mt-1 leading-[1.55] text-muted">{item.body}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function NumbersSection() {
  return (
    <section aria-labelledby="hive-numbers" className="hive-section hive-wrap">
      <SectionHeading id="hive-numbers">{numbers.heading}</SectionHeading>
      <dl className="mt-8 grid grid-cols-1 gap-y-5 sm:grid-cols-5 sm:gap-x-6">
        {numbers.items.map((item) => (
          <div key={item.label} className="flex items-baseline gap-4 sm:flex-col sm:gap-1">
            <dt className="order-2 text-muted sm:order-none">{item.label}</dt>
            <dd className="order-1 m-0 font-dot hive-number sm:order-none">{item.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function MoreSection() {
  return (
    <section aria-labelledby="hive-more" className="hive-section hive-wrap pb-32">
      <SectionHeading id="hive-more">{more.heading}</SectionHeading>
      <ul className="mt-6 flex flex-wrap gap-x-8 gap-y-3 text-[1.0625rem]">
        {more.links.map((link) => (
          <li key={link.href}>
            {link.external ? (
              <a href={link.href} target="_blank" rel="noopener noreferrer" className="hive-link">{link.label}</a>
            ) : (
              <Link href={link.href} className="hive-link">{link.label}</Link>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-10 max-w-[40rem] text-sm text-muted">{framing}</p>
    </section>
  );
}
