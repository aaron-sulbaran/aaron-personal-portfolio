import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { ArrowUpRight } from "lucide-react";
import { siteContent } from "@/lib/content";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Work",
  description: "Projects, internships, and communities I've poured real time into.",
};

export default function WorkIndexPage() {
  const { label, indexHeading, indexLede } = siteContent.work;
  const items = siteContent.workItems;

  return (
    <>
      <main id="main" className="relative min-h-screen">
        <section className="relative w-full px-6 pb-16 pt-32 md:px-10 md:pb-24 md:pt-40">
          <div className="mx-auto max-w-6xl">
            <div className="mb-12 flex flex-col gap-6 md:mb-20">
              <div className="flex items-center gap-3 text-[11px] font-medium uppercase tracking-caps text-muted">
                <span className="inline-block h-px w-8 bg-border" aria-hidden="true" />
                <span>{label}</span>
              </div>
              <h1 className="font-serif text-[clamp(4rem,10vw,8rem)] italic leading-[0.95] tracking-tight text-foreground">
                {indexHeading}
              </h1>
              <p className="max-w-xl text-lg leading-[1.55] text-muted md:text-xl">
                {indexLede}
              </p>
            </div>

            <ul className="border-t border-border/70">
              {items.map((item) => (
                <li key={item.slug} className="border-b border-border/70">
                  <Link
                    href={`/work/${item.slug}`}
                    className="group flex items-center gap-5 py-6 md:py-8"
                  >
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-glass shadow-[0_6px_18px_-12px_rgba(10,10,10,0.4)] md:h-14 md:w-14">
                      <Image
                        src={item.logo}
                        alt={`${item.title} logo`}
                        fill
                        sizes="56px"
                        className="object-contain p-1.5"
                      />
                    </div>
                    <div className="flex flex-1 items-baseline justify-between gap-4 min-w-0">
                      <div className="flex flex-col gap-1 md:flex-row md:items-baseline md:gap-5">
                        <span className="font-serif text-2xl italic leading-tight text-foreground transition-colors duration-200 group-hover:text-accent md:text-4xl">
                          {item.title}
                        </span>
                        <span className="text-[11px] font-medium uppercase tracking-caps text-muted">
                          {item.role} · {item.year}
                        </span>
                      </div>
                      <ArrowUpRight
                        aria-hidden="true"
                        className="h-5 w-5 shrink-0 text-muted transition-all duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent"
                      />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
