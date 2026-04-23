import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowUpRight } from "lucide-react";
import { siteContent, type WorkBodySection } from "@/lib/content";
import { Footer } from "@/components/Footer";

type Params = { params: { slug: string } };

export function generateStaticParams() {
  return siteContent.workItems.map((item) => ({ slug: item.slug }));
}

export function generateMetadata({ params }: Params): Metadata {
  const item = siteContent.workItems.find((i) => i.slug === params.slug);
  if (!item) return { title: "Not found" };
  return {
    title: `${item.title} · ${item.role}`,
    description: item.summary,
    openGraph: {
      title: `${item.title} — ${item.role}`,
      description: item.summary,
    },
  };
}

export default function WorkDetailPage({ params }: Params) {
  const item = siteContent.workItems.find((i) => i.slug === params.slug);
  if (!item) notFound();

  const { backLabel, placeholderBody } = siteContent.work;
  const linkedinHref = siteContent.connect.links.find((l) => l.key === "linkedin")?.href;

  return (
    <>
      <main id="main" className="relative min-h-screen">
        <article className="relative w-full px-6 pb-24 pt-32 md:px-10 md:pb-40 md:pt-40">
          <div className="mx-auto max-w-4xl">
            <Link
              href="/work"
              className="mb-12 inline-flex items-center gap-2 text-[12px] font-medium uppercase tracking-caps text-muted transition-colors duration-200 hover:text-accent md:mb-16"
            >
              {backLabel}
            </Link>

            <div className="mb-10 flex flex-wrap items-center gap-5 md:mb-14">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-glass shadow-[0_10px_24px_-14px_rgba(10,10,10,0.4)] md:h-24 md:w-24">
                <Image
                  src={item.logo}
                  alt={`${item.title} logo`}
                  fill
                  sizes="96px"
                  className="object-contain p-3"
                />
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-[11px] font-medium uppercase tracking-caps text-muted">
                  {item.role} · {item.year}
                </span>
                <h1 className="font-serif text-[clamp(3rem,8vw,6rem)] italic leading-[0.95] tracking-tight text-foreground">
                  {item.title}
                </h1>
              </div>
            </div>

            <p className="mb-12 max-w-2xl text-xl leading-[1.55] text-foreground md:mb-16 md:text-2xl">
              {item.summary}
            </p>

            {item.bodySections.length === 0 ? (
              <div className="rounded-2xl border border-border/70 bg-glass-strong px-6 py-8 backdrop-blur-md md:px-10 md:py-12">
                <p className="font-serif text-xl italic leading-[1.45] text-foreground md:text-2xl">
                  {placeholderBody}
                </p>
                {linkedinHref && (
                  <Link
                    href={linkedinHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-5 inline-flex items-center gap-2 text-base font-medium text-accent transition-colors duration-200 hover:text-accent-hover"
                  >
                    Ping me on LinkedIn
                    <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
                  </Link>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-8">
                {(item.bodySections as ReadonlyArray<WorkBodySection>).map((section, i) => (
                  <div key={i}>
                    {section.kind === "paragraph" ? (
                      <p className="text-lg leading-[1.65] text-foreground md:text-xl">
                        {section.text}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}

            {item.links.length > 0 && (
              <div className="mt-14 flex flex-wrap gap-6 border-t border-border/70 pt-8">
                {item.links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex items-center gap-2 text-base font-medium text-accent transition-colors duration-200 hover:text-accent-hover"
                  >
                    {link.label}
                    <ArrowUpRight aria-hidden="true" className="h-4 w-4 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </article>
      </main>
      <Footer />
    </>
  );
}
