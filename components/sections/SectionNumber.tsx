// A page's number (01 to 04, lib/content.ts PAGE_NUMBERS), a small label in the
// label face above or beside its heading; the heading says the page, so the
// number is drawn only (aria-hidden), never read twice. Muted, tabular, and one
// size everywhere so the four pages' labels match.
export function SectionNumber({ value, className = "" }: { value: string; className?: string }) {
  return (
    <p aria-hidden="true" data-section-number="" className={`font-label text-label-sm tabular-nums text-muted ${className}`}>
      {value}
    </p>
  );
}
