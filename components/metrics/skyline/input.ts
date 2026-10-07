import { ELEV_3D, ELEV_RANGE, YAW_3D, YAW_RANGE } from "@/lib/metrics/skyline/maths";
import type { Scene } from "./draw";
import type { EngineConfig } from "./engine";
import { pointInQuad } from "./paint";

// Pointer and keyboard input for the engine: hover and tap a day, drag to
// orbit in 3D, double-click to reset, arrow keys to walk the grid.

// The engine state input reads and writes.
export type Ctl = {
  target: number;
  yawGoal: number;
  elevGoal: number;
  hovered: number;
  pinned: number;
  // Keyboard bounds: the first and last real day (pads and future days are not stops).
  firstDay: number;
  lastDay: number;
};

type Host = {
  s: Scene;
  ctl: Ctl;
  cfg: { current: EngineConfig };
  kick: () => void;
  refreshActive: () => void;
  orbitable: () => boolean;
};

export function attachInput({ s, ctl, cfg, kick, refreshActive, orbitable }: Host): () => void {
  const { canvas } = s;

const hit = (x: number, y: number): number => {
  for (let k = s.n - 1; k >= 0; k--) {
    const i = s.order[k];
    if (s.skip[i] || s.lv[i] === 5) continue;
    const o = i * 24;
    if (pointInQuad(s.polys, o, x, y)) return i;
    if (s.faces[i] & 1 && pointInQuad(s.polys, o + 8, x, y)) return i;
    if (s.faces[i] & 2 && pointInQuad(s.polys, o + 16, x, y)) return i;
  }
  return -1;
};

const local = (ev: PointerEvent) => {
  const r = canvas.getBoundingClientRect();
  return [ev.clientX - r.left, ev.clientY - r.top] as const;
};

let drag: { id: number; x: number; y: number; yaw: number; elev: number; moved: boolean; orbit: boolean; mouse: boolean } | null = null;

const onDown = (ev: PointerEvent) => {
  if (ev.button !== 0) return;
  const can = orbitable();
  drag = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, yaw: ctl.yawGoal, elev: ctl.elevGoal, moved: false, orbit: can, mouse: ev.pointerType === "mouse" };
  if (can) {
    try {
      canvas.setPointerCapture(ev.pointerId);
    } catch {
      /* capture is a nicety */
    }
  }
};

const onMove = (ev: PointerEvent) => {
  if (drag && drag.orbit && ev.pointerId === drag.id) {
    const dx = ev.clientX - drag.x;
    const dyy = ev.clientY - drag.y;
    if (drag.moved || Math.hypot(dx, dyy) > 4) {
      drag.moved = true;
      ctl.yawGoal = Math.min(YAW_RANGE[1] - YAW_3D, Math.max(YAW_RANGE[0] - YAW_3D, drag.yaw + dx * 0.006));
      if (drag.mouse) ctl.elevGoal = Math.min(ELEV_RANGE[1] - ELEV_3D, Math.max(ELEV_RANGE[0] - ELEV_3D, drag.elev + dyy * 0.004));
      canvas.style.cursor = "grabbing";
      ctl.hovered = -1;
      refreshActive();
      kick();
      return;
    }
  }
  if (ev.pointerType !== "mouse") return;
  const [x, y] = local(ev);
  const i = hit(x, y);
  if (i !== ctl.hovered) {
    ctl.hovered = i;
    refreshActive();
  }
  canvas.style.cursor = orbitable() ? "grab" : i >= 0 ? "pointer" : "default";
};

const onUp = (ev: PointerEvent) => {
  if (!drag || ev.pointerId !== drag.id) return;
  const wasMoved = drag.moved;
  drag = null;
  if (canvas.hasPointerCapture(ev.pointerId)) canvas.releasePointerCapture(ev.pointerId);
  canvas.style.cursor = orbitable() ? "grab" : "default";
  if (wasMoved) return;
  const [x, y] = local(ev);
  const i = hit(x, y);
  ctl.pinned = i === ctl.pinned ? -1 : i;
  if (ev.pointerType !== "mouse") ctl.hovered = -1;
  refreshActive();
};

const onCancel = () => {
  drag = null;
};

const onLeave = () => {
  if (drag) return;
  ctl.hovered = -1;
  refreshActive();
};

const onDbl = () => {
  ctl.yawGoal = 0;
  ctl.elevGoal = 0;
  kick();
};

const KEYS = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "Escape", "Enter", " "];
const onKey = (ev: KeyboardEvent) => {
  if (!KEYS.includes(ev.key) || !s.n) return;
  if (ev.key === "Escape") {
    if (ctl.pinned < 0 && ctl.hovered < 0) return; // nothing to clear: let Escape reach the page
    ev.preventDefault();
    ctl.pinned = -1;
    ctl.hovered = -1;
    refreshActive();
    return;
  }
  ev.preventDefault();
  let i = ctl.pinned >= 0 ? ctl.pinned : s.activeIdx >= 0 ? s.activeIdx : ctl.lastDay;
  if (ctl.pinned >= 0 || s.activeIdx >= 0) {
    if (ev.key === "ArrowLeft") i -= 7;
    if (ev.key === "ArrowRight") i += 7;
    if (ev.key === "ArrowUp") i -= 1;
    if (ev.key === "ArrowDown") i += 1;
    if (ev.key === "Home") i = ctl.firstDay;
    if (ev.key === "End") i = ctl.lastDay;
  }
  i = Math.max(ctl.firstDay, Math.min(ctl.lastDay, i));
  ctl.pinned = i;
  ctl.hovered = -1;
  refreshActive();
  cfg.current.setAnnounce(cfg.current.describe(i));
};

const onBlur = () => {
  ctl.pinned = -1;
  refreshActive();
};

  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onCancel);
  canvas.addEventListener("pointerleave", onLeave);
  canvas.addEventListener("dblclick", onDbl);
  canvas.addEventListener("keydown", onKey);
  canvas.addEventListener("blur", onBlur);

  return () => {
    canvas.removeEventListener("pointerdown", onDown);
    canvas.removeEventListener("pointermove", onMove);
    canvas.removeEventListener("pointerup", onUp);
    canvas.removeEventListener("pointercancel", onCancel);
    canvas.removeEventListener("pointerleave", onLeave);
    canvas.removeEventListener("dblclick", onDbl);
    canvas.removeEventListener("keydown", onKey);
    canvas.removeEventListener("blur", onBlur);
  };
}
