import type { ReactNode } from "react";

// A line that ends in an icon (an arrow, a chevron): the last word and the icon
// never part, so a wrapped line cannot leave the icon alone on the next row.
export function TrailingIcon({ text, icon }: { text: string; icon: ReactNode }) {
  const split = text.lastIndexOf(" ");
  const head = split < 0 ? "" : text.slice(0, split + 1);
  const last = split < 0 ? text : text.slice(split + 1);
  return (
    <>
      {head}
      <span className="whitespace-nowrap">
        {last}
        {icon}
      </span>
    </>
  );
}
