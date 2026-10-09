export interface Point { x: number; y: number }
export interface Size { width: number; height: number }
export interface Rect { left: number; top: number; right: number; bottom: number; width: number; height: number }
// The shared label's geometry (components/inline/TipBubble): beside a mouse
// pointer like a multiplayer name tag, or centred under a focused or tapped
// link; flipped near a viewport edge and clamped inside the margin.
export const TIP_GEOMETRY = { offsetX: 14, offsetY: 18, gap: 8, margin: 12 } as const;
const clamp = (value: number, low: number, high: number) => Math.min(Math.max(value, low), Math.max(low, high));
export function followPosition(pointer: Point, size: Size, view: Size, g = TIP_GEOMETRY): Point {
  const right = pointer.x + g.offsetX;
  const below = pointer.y + g.offsetY;
  const x = right + size.width > view.width - g.margin ? pointer.x - g.offsetX - size.width : right;
  const y = below + size.height > view.height - g.margin ? pointer.y - g.offsetY - size.height : below;
  return { x: clamp(x, g.margin, view.width - g.margin - size.width), y: clamp(y, g.margin, view.height - g.margin - size.height) };
}
export function anchorPosition(link: Rect, size: Size, view: Size, g = TIP_GEOMETRY): Point {
  const below = link.bottom + g.gap;
  const y = below + size.height > view.height - g.margin ? link.top - g.gap - size.height : below;
  const x = link.left + link.width / 2 - size.width / 2;
  return { x: clamp(x, g.margin, view.width - g.margin - size.width), y: Math.max(g.margin, y) };
}
