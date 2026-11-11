import Link from "next/link";
import type { ReactNode } from "react";
import { hiveStoryCopy } from "@/lib/content/hive-story";
import { ScenarioSwarm } from "./Drawings";
import { HiveLoopDemo } from "./HiveLoopDemo";
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
            <div className="rounded-[18px] bg-[var(--hive-panel)] p-3"><ScenarioSwarm scenario={item.key} /></div>
            <h3 className="mt-4 text-[1.0625rem] font-semibold">{item.title}</h3>
            <p className="mt-1.5 leading-[1.55] text-muted">{item.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Marker() {
  return <span aria-hidden="true" className="hive-marker hive-marker-next mt-[0.45rem]" />;
}

/** The calls, shown before they're said: the demo of an AI note reaching its author, the tools built for the Hive, then each call in a line. */
export function CallsSection() {
  const { tools } = calls;
  return (
    <section aria-labelledby="hive-calls" className="hive-section hive-wrap">
      <SectionHeading id="hive-calls">{calls.heading}</SectionHeading>
      <div className="mt-10">
        <HiveLoopDemo />
      </div>
      <h3 className="mt-14 font-label text-label-lg">{calls.toolsLabel}</h3>
      <div className="mt-5 grid gap-10 md:grid-cols-2 md:gap-12">
        {[tools.connector, tools.beekeeper].map((group) => (
          <div key={group.label} className="min-w-0">
            <p className="flex items-center gap-3 font-semibold"><Marker />{group.label}</p>
            <ul className="mt-3 grid gap-3 sm:gap-2">
              {group.items.map((tool) => (
                <li key={tool.name} className="grid gap-x-4 leading-[1.45] sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)]">
                  {/^(hive_|\/)/.test(tool.name) ? <code className="hive-tool-name">{tool.name}</code> : <span className="font-semibold">{tool.name}</span>}
                  <span className="text-muted">{tool.body}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <dl className="mt-14 grid gap-x-12 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
        {calls.items.map((item) => (
          <div key={item.title} className="min-w-0">
            <dt className="font-semibold">{item.title}</dt>
            <dd className="m-0 text-muted">{item.body}</dd>
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
      <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-6 md:grid-cols-4">
        {numbers.items.map((item) => (
          <div key={item.label} className="flex flex-col-reverse gap-1">
            <dt className="text-muted">{item.label}</dt>
            <dd className="m-0 font-dot hive-number">{item.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** Aaron's MVP label, "M(inimum) V(iable) P(ortfolio)": the three capitals carry the weight. */
function MvpLabel({ text }: { text: string }) {
  return <>{text.split(/([MVP])(?=\()/).map((part, i) => (/^[MVP]$/.test(part) ? <b key={i}>{part}</b> : part))}</>;
}

/** A link home: a plain path goes through next/link, a section of the home through a real navigation, as the Menu does (lib/scroll.ts), so the home places the scroll. */
export function SiteLink({ href, children }: { href: string; children: ReactNode }) {
  if (href.includes("#")) return <a href={href} className="hive-link">{children}</a>;
  return <Link href={href} className="hive-link">{children}</Link>;
}

export function MoreSection() {
  return (
    <section aria-labelledby="hive-more" className="hive-section hive-wrap pb-32">
      <SectionHeading id="hive-more">{more.heading}</SectionHeading>
      <ul className="hive-links mt-4 flex flex-wrap gap-x-8 text-[1.0625rem]">
        {more.site.map((link) => (
          <li key={link.href}><SiteLink href={link.href}>{link.href === "/quick" ? <MvpLabel text={link.label} /> : link.label}</SiteLink></li>
        ))}
      </ul>
      <h3 className="mt-6 font-label text-label">{more.productsLabel}</h3>
      <ul className="hive-links mt-1 flex flex-wrap gap-x-8 text-[1.0625rem]">
        {more.products.map((link) => (
          <li key={link.href}>
            <a href={link.href} target="_blank" rel="noopener noreferrer" className="hive-link">{link.label}</a>
          </li>
        ))}
      </ul>
      <p className="mt-10 max-w-[40rem] text-sm text-muted">{framing}</p>
    </section>
  );
}
