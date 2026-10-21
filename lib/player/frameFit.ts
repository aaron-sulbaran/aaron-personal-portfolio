// The lab's preview frame, pure: the real home page in an iframe, kept at a
// layout size and scaled down to fit the room beside the panel.

export type FrameDevice = "desktop" | "phone";

export const FRAME_SIZES = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } } as const;

interface Size {
  width: number;
  height: number;
}

// The scale that fits a design size into the room, never past life size. A
// desktop frame fits by width (it scrolls inside), a phone by height.
export function fitScale(room: Size, device: FrameDevice): number {
  if (room.width <= 0 || room.height <= 0) return 1;
  const design = FRAME_SIZES[device];
  return Math.min(1, device === "phone" ? room.height / design.height : room.width / design.width);
}

// The frame's own size before scaling. A desktop frame is as wide as the room
// when the room is wider than 1440 (the layout then follows the real width),
// else 1440 wide and scaled down; either way it fills the room's height.
export function frameSize(room: Size, device: FrameDevice): Size & { scale: number } {
  const design = FRAME_SIZES[device];
  const scale = fitScale(room, device);
  if (device === "phone") return { ...design, scale };
  return { width: Math.max(design.width, room.width), height: Math.max(1, room.height / scale), scale };
}
