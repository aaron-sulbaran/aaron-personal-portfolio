import { useId } from "react";
import { siteContent } from "@/lib/content";
import { partId } from "@/lib/gallery/timing";

// The Mentorship card's mentors, a section of its modal: each name a link to
// their LinkedIn, and the line I write for them once I have.
export function MentorsList({ compact = false }: { compact?: boolean }) {
  const { title, people } = siteContent.cards.mentorship.mentors;
  const headingId = useId();
  if (!people.length) return null;
  return (
    <section data-mask={partId.mentors} data-mask-kind="text" aria-labelledby={headingId} className="flex flex-col gap-3" data-mentors="">
      <h3 id={headingId} className={`font-display leading-tight text-foreground ${compact ? "text-xl" : "text-2xl"}`}>{title}</h3>
      <ul className="flex flex-col gap-2">
        {people.map((mentor) => (
          <li key={mentor.href} className="flex flex-col gap-0.5">
            <a href={mentor.href} target="_blank" rel="noopener noreferrer" className="w-fit font-label text-label-lg text-accent transition-colors duration-200 hover:text-accent-hover">
              {mentor.name}
              <span className="sr-only">, {siteContent.book.externalLabel}</span>
            </a>
            {mentor.line && <p className="text-base leading-relaxed text-foreground">{mentor.line}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
