import type { QuickItem } from "@/lib/quick/items";

export interface VariantProps {
  items: readonly QuickItem[];
  runKey: string;
  speed: number;
  forceReduced: boolean;
}
