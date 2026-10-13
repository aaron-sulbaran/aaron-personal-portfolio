import type { CardKey } from "@/lib/content/types";
import type { YearRow } from "@/lib/quick/years";

export type OpenCard = (key: CardKey, origin: HTMLElement) => void;

export interface VariantProps {
  rows: readonly YearRow[];
  closing: string;
  runKey: string;
  speed: number;
  forceReduced: boolean;
  onOpen: OpenCard;
}
