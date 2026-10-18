import type { CardKey } from "@/lib/content/types";
import type { YearRow } from "@/lib/quick/years";

export type OpenCard = (key: CardKey, origin: HTMLElement) => void;

export interface VariantProps {
  rows: readonly YearRow[];
  // The full what's-next line (A), or null while A is off.
  next: string | null;
  runKey: string;
  speed: number;
  forceReduced: boolean;
  onOpen: OpenCard;
}
