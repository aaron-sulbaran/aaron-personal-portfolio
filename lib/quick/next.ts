import { DEFAULT_NEXT_ID, quickNextVariants, type QuickNextId } from "@/lib/content/quick";

// What I am looking for next, in two places that lead to the same thing without
// repeating word for word: B, a short line under the intro, and A, the full line
// in the What's next section at the foot of the page, below the rail and apart
// from it. The lab picks a named variant or writes its own ("custom"). Pure.

export const NEXT_SECTION_ID = "whats-next";
export const NEXT_HEADING_ID = "whats-next-heading";

export type NextChoice = QuickNextId | "custom";

export const NEXT_CHOICES: readonly NextChoice[] = [...quickNextVariants.map((variant) => variant.id), "custom"];

export interface NextLines {
  // B: finishes "Currently looking for:".
  short: string;
  // A: the What's next section's sentence.
  full: string;
}

export interface CustomNext {
  customShort: string;
  customFull: string;
}

export const variantOf = (id: QuickNextId) => quickNextVariants.find((variant) => variant.id === id)!;

export const DEFAULT_CUSTOM_NEXT: CustomNext = { customShort: variantOf(DEFAULT_NEXT_ID).short, customFull: variantOf(DEFAULT_NEXT_ID).full };

export function parseNextChoice(value: unknown): NextChoice {
  return NEXT_CHOICES.includes(value as NextChoice) ? (value as NextChoice) : DEFAULT_NEXT_ID;
}

export function nextLines(choice: NextChoice, custom: CustomNext = DEFAULT_CUSTOM_NEXT): NextLines {
  if (choice === "custom") return { short: custom.customShort.trim(), full: custom.customFull.trim() };
  const { short, full } = variantOf(choice);
  return { short, full };
}
