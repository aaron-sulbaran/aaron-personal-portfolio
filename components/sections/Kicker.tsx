import { Block } from "./Block";

// A section's kicker: a short rule that draws, then its label, in the label
// face at the label step (docs/label-face-spec.md: kickers are muted).
// labelId names the words for a group that is labelled by them
// (aria-labelledby).
export function Kicker({ label, labelId }: { label: string; labelId?: string }) {
  return (
    <Block kind="kicker" className="flex items-center gap-3 font-label text-label text-muted">
      <span data-sections-rule aria-hidden="true" className="inline-block h-px w-8 origin-left bg-border" />
      <span data-sections-label id={labelId}>{label}</span>
    </Block>
  );
}
