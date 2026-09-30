import { Vector4, type ShaderMaterial, type Texture } from "three";
import { siteContent } from "@/lib/content";
import { clamp01, helixRotation, isNarrow, smoothstep01, unprojectToPlane, type HelixFrame } from "@/lib/coil/geometry";
import { settleUnwind, toggleUnwind, unwindDurationMs, unwindProgress } from "@/lib/coil/unwind";
import type { Hover } from "./hover";
import type { Name } from "./name";
import type { LoopLink, SceneCtx, SceneFrame } from "./state";

// The unwind egg's wiring (slice 5): a double-click on open hero space with
// the page at the top unwinds the helix into a column beside the overlay's
// rows (the canvas name moves to the list's lead), and again winds it back.
// The latch and the per card modifier are pure, in lib/coil/unwind.ts; this
// holds the latch in the frame, measures the rows, and moves the name.

const unwindEase = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

export function createUnwindWiring(ctx: SceneCtx, comp: ShaderMaterial, name: Name, hover: Hover, loop: LoopLink) {
  const { st, host, live, tiles, tileCount, debug } = ctx;
  const { unwind, conveyor, view } = st;
  const nameRest = new Vector4();
  const nameWritten = new Vector4(Number.NaN, 0, 0, 0);
  let nameRestLod = 0;
  let nameRestInk = 0;
  let nameLodWritten = Number.NaN;
  let nameInkWritten = Number.NaN;
  const probe = document.createElement("canvas").getContext("2d");

  function canUnwind() {
    const props = live.current;
    return st.ready && props.interactive && props.input === "fine" && !props.frozen && !st.frozenByApi && window.scrollY <= 2;
  }

  // api.unwind: sets (or toggles) the unwind; false winds the coil back.
  function toggle(on?: boolean) {
    const next = on ?? !unwind.on;
    if (next === unwind.on) return;
    if (next && !canUnwind()) return;
    toggleUnwind(unwind, performance.now(), conveyor.offset, tileCount, next);
    if (debug) debug.unwindAt?.push(performance.now());
    loop.wake();
  }

  // Double-click open hero space (not a card, not a control) with the page at
  // the top: the helix unwinds in place; again, it winds back.
  const onDoubleClick = (event: MouseEvent) => {
    if (!(event.target instanceof Node) || !host.contains(event.target)) return;
    const x = event.clientX - (view.docLeft - window.scrollX);
    const y = event.clientY - (view.docTop - window.scrollY);
    if (hover.pickAt(x, y) >= 0) return;
    if (!unwind.on && !canUnwind()) return;
    toggle(!unwind.on);
  };

  function listen() {
    host.addEventListener("dblclick", onDoubleClick);
    return () => host.removeEventListener("dblclick", onDoubleClick);
  }

  // The rows' card boxes, measured from the overlay each latched frame (it
  // moves with the page and relayouts on resize), onto the z = 0 plane.
  function measureColumn(helix: HelixFrame) {
    if (!st.geoCamera) return null;
    const boxes = live.current.overlay.current?.listTargets();
    if (!boxes) return null;
    const rect = host.getBoundingClientRect();
    const camera = st.geoCamera;
    return {
      axisCenter: helix.center,
      axisDirection: helixRotation(helix).y,
      targets: tiles.map((tile) => {
        const box = boxes.get(tile.key);
        if (!box || box.height <= 0) return null;
        const x = box.left + box.width / 2 - rect.left;
        const y = box.top + box.height / 2 - rect.top;
        return { position: unprojectToPlane(camera, x, y, 0), scale: box.height * camera.worldPerPx };
      }),
    };
  }

  // Per frame: the overlay's fades, and the canvas name moving from its rest
  // rect into the list's lead (lab 1327-1360), inked to full as it lands.
  // A layout or theme change rewrites the rest values; they are recaptured
  // whenever the uniforms hold something this block did not write.
  function unwindFrame(progress: number) {
    live.current.overlay.current?.unwindFrame(progress, unwind.on);
    const cu = comp.uniforms;
    const rect = cu.uNameRect.value as Vector4;
    if (!rect.equals(nameWritten)) nameRest.copy(rect);
    if (cu.uLod.value !== nameLodWritten) nameRestLod = cu.uLod.value;
    if (cu.uNameK.value !== nameInkWritten) nameRestInk = cu.uNameK.value;
    const target = progress > 0 ? nameTarget() : null;
    if (!target) {
      rect.copy(nameRest);
      cu.uLod.value = nameRestLod;
      cu.uNameK.value = nameRestInk;
    } else {
      const t = unwindEase(clamp01((progress - 0.08) / 0.84));
      const land = smoothstep01(clamp01((progress - 0.5) / 0.47));
      rect.set(
        nameRest.x + (target.x - nameRest.x) * t,
        nameRest.y + (target.y - nameRest.y) * t,
        nameRest.z + (target.z - nameRest.z) * t,
        nameRest.w + (target.w - nameRest.w) * t,
      );
      const maskHeight = ((cu.uName.value as Texture | null)?.image as HTMLCanvasElement | undefined)?.height ?? 0;
      cu.uLod.value = maskHeight ? Math.max(0, Math.log2(maskHeight / (rect.w * view.dpr))) : nameRestLod;
      cu.uNameK.value = nameRestInk + (1 - nameRestInk) * land;
    }
    nameWritten.copy(rect);
    nameLodWritten = cu.uLod.value;
    nameInkWritten = cu.uNameK.value;
  }

  // The name mask's rect at the lead slot's font size: the rest mask scaled
  // by the size ratio, its ink box on the slot's text (layoutName's sizing).
  function nameTarget(): Vector4 | null {
    const slot = live.current.overlay.current?.nameSlot();
    if (!slot || !probe) return null;
    const text = siteContent.hero.name;
    probe.font = `900 100px ${st.nameFamily}`;
    const w100 = probe.measureText(text).width || 1;
    const restSize = ((view.width * (isNarrow(view) ? 0.9 : 0.7)) / w100) * 100;
    const pad = Math.ceil(restSize * 0.04);
    const k = slot.fontPx / restSize;
    probe.font = `900 ${slot.fontPx}px ${st.nameFamily}`;
    const m = probe.measureText(text);
    const hostRect = host.getBoundingClientRect();
    const left = slot.rect.left - hostRect.left - m.actualBoundingBoxLeft;
    const baseline =
      slot.rect.top - hostRect.top + (slot.fontPx - (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent)) / 2 + m.fontBoundingBoxAscent;
    const inkTop = baseline - m.actualBoundingBoxAscent;
    // fx-hero: the mask carries the greeting's band above the name's pad.
    return new Vector4(left - pad * k, inkTop - (pad + name.greetBlock()) * k, nameRest.z * k, nameRest.w * k);
  }

  // ---- slice 5 wiring block: the unwind ----
  // Update step. While latched the conveyor holds still, so every latched
  // copy keeps its slot and the wind-back lands on the exact pose it left.
  function step(f: SceneFrame) {
    const { now } = f;
    if (settleUnwind(unwind, now)) unwind.column = null;
    if (unwind.latched) {
      conveyor.offset = unwind.offset;
      conveyor.target = unwind.offset;
      conveyor.glide = null;
      unwind.column = measureColumn(f.helix as HelixFrame);
    }
    f.listProgress = unwindProgress(unwind, now);
    unwindFrame(f.listProgress);
  }
  // ---- end slice 5 block ----

  // QA: the unwind's state and its length.
  function unwindState() {
    return { on: unwind.on, latched: unwind.latched !== null, progress: unwindProgress(unwind, performance.now()) };
  }

  return { unwind: toggle, listen, step, unwindState, unwindMs: () => unwindDurationMs(tileCount) };
}

export type UnwindWiring = ReturnType<typeof createUnwindWiring>;
