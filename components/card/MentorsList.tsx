import { useId } from "react";
import { siteContent } from "@/lib/content";
import { partId } from "@/lib/gallery/timing";

// The Mentorship card's mentors, a section of its modal: each name a link to
// their LinkedIn, and the line I wrote for them. The phone's pager draws one
// mentor at a time (only), so a page holds as many of them as fit and the rest
// follow on the next, never scrolling inside a page: the first mentor carries
// the heading, the others stand without it.
export function MentorsList({ compact = false, only }: { compact?: boolean; only?: number }) {
  const { title, people } = siteContent.cards.mentorship.mentors;
  const headingId = useId();
  const shown = only === undefined ? people : people.slice(only, only + 1);
  if (!shown.length) return null;
  const headed = only === undefined || only === 0;
  const list = (
    <ul className="flex flex-col gap-2">
      {shown.map((mentor) => (
        <li key={mentor.href} className="flex flex-col gap-0.5">
          <a href={mentor.href} target="_blank" rel="noopener noreferrer" className="w-fit font-label text-label-lg text-accent transition-colors duration-200 hover:text-accent-hover">
            {mentor.name}
            <span className="sr-only">, {siteContent.columns.externalLabel}</span>
          </a>
          {mentor.line && <p className="text-base leading-relaxed text-foreground">{mentor.line}</p>}
        </li>
      ))}
    </ul>
  );
  if (!headed) return <div data-mentors="" data-mentor={only}>{list}</div>;
  return (
    <section data-mask={partId.mentors} data-mask-kind="text" aria-labelledby={headingId} className="flex flex-col gap-3" data-mentors="">
      <h3 id={headingId} className={`font-display leading-tight text-foreground ${compact ? "text-xl" : "text-2xl"}`}>{title}</h3>
      {list}
    </section>
  );
}
