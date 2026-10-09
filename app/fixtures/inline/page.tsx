import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InlineCopy } from "@/components/inline/InlineCopy";
import { Block } from "@/components/sections/Block";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };
// The surface for e2e/inline-links.spec.ts: each ?copy= string rendered the
// way the sections render prose, through a lines-split body Block. It exists
// only while the server runs with E2E_FIXTURES=1 (playwright.config.ts);
// everywhere else, production included, it is a 404.
export default async function InlineFixture({ searchParams }: { searchParams: Promise<{ copy?: string | string[] }> }) {
  if (process.env.E2E_FIXTURES !== "1") notFound();
  const { copy } = await searchParams;
  const copies = (Array.isArray(copy) ? copy : copy ? [copy] : []).slice(0, 8).map((text) => text.slice(0, 600));
  return (
    <main id="main" className="mx-auto flex max-w-2xl flex-col gap-10 px-6 py-24">
      {copies.map((text, index) => (
        <Block key={index} kind="body" as="p" className="text-xl leading-[1.6] text-foreground md:text-[22px] md:leading-[1.55]">
          <InlineCopy source={text} />
        </Block>
      ))}
    </main>
  );
}
