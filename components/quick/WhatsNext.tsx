import { siteContent } from "@/lib/content";
import { quickCopy } from "@/lib/content/quick";
import { inlineLinkElement } from "@/lib/inline/attrs";
import { NEXT_HEADING_ID, NEXT_SECTION_ID } from "@/lib/quick/next";

// What I am looking for next, at the foot of the page: its own section after the
// rail ends, off the rail (no dot, no line). The top margin is the gap between
// the end of the rail and this heading; it stays empty. The heading takes focus
// when "Currently looking for:" scrolls here. Under the line sits one quieter
// sentence that sends anyone who wants my resume to LinkedIn to ask for it.

const { resume } = quickCopy.next;
const messageHref = siteContent.connect.links.find((link) => link.key === resume.linkKey)!.href;
const message = inlineLinkElement({ kind: "external", text: resume.link, href: messageHref, strong: false, em: false })!;

export function WhatsNext({ line }: { line: string }) {
  return (
    <section id={NEXT_SECTION_ID} data-quick-next="" aria-labelledby={NEXT_HEADING_ID} className="mt-48 scroll-mt-40 md:mt-72">
      <h2 id={NEXT_HEADING_ID} tabIndex={-1} className="font-display text-[2.75rem] leading-none text-foreground outline-none md:text-[3.5rem]" data-lane-line="">
        {quickCopy.next.label}
      </h2>
      <p data-quick-next-line="" className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground md:text-body-lg" data-lane-line="">
        {line}
      </p>
      <p data-quick-resume="" data-lane-line="" data-lane-whole="" className="mt-3 max-w-2xl text-base leading-relaxed text-muted">
        {resume.before}
        <a {...message.props}>{resume.link}</a>
        {resume.after}
      </p>
    </section>
  );
}
