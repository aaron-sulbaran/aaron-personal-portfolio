import { COIL } from "@/lib/coil/constants";
import { FIELD } from "@/lib/coil/field.glsl";
import type { FlightPose } from "@/lib/coil/flight";
import { bendLocal as bendLocalPoint, projectPoint, projectQuad, type CardPose } from "@/lib/coil/geometry";
import type { Cards } from "./cards";
import type { LoopLink, SceneCtx } from "./state";

// ---- fx-flight debug: ?coildebug=flight, the measurement hook ----
// The scene's side of lib/coil/flightProbe.ts: its live state for the
// probe's marks, and window.__coilFlight.scene, the hooks the flight specs
// use to follow a slot, read its projected outline and face grid, and show or
// hide its mesh at each swap. Without the flight token the probe is null and
// nothing here is installed (state() is still what the marks would carry).

type FlightView = { slot: number; state: string; gap: number; pose: FlightPose | null };

export function createProbe(ctx: SceneCtx, cards: Cards, loop: LoopLink) {
  const { st, host, live, tiles, flightLog } = ctx;
  const { slots } = cards;
  let probeSlot = -1; // the slot the harness follows

  function poseInfo(pose: CardPose) {
    if (!st.geoCamera) return null;
    const rect = host.getBoundingClientRect();
    const origin = { left: rect.left, top: rect.top };
    const camera = st.geoCamera;
    const hw = COIL.cardAspect / 2;
    const at = (x: number, y: number) => {
      const b = bendLocalPoint(x, y, pose.bend, pose.beta);
      const world: [number, number, number] = [
        pose.position[0] + (pose.basis.x[0] * b[0] + pose.basis.y[0] * b[1] + pose.basis.z[0] * b[2]) * pose.scale,
        pose.position[1] + (pose.basis.x[1] * b[0] + pose.basis.y[1] * b[1] + pose.basis.z[1] * b[2]) * pose.scale,
        pose.position[2] + (pose.basis.x[2] * b[0] + pose.basis.y[2] * b[1] + pose.basis.z[2] * b[2]) * pose.scale,
      ];
      return projectPoint(camera, world, origin);
    };
    // The bent silhouette: 17 points along each edge, in corner order.
    const steps = 16;
    const edge = (x0: number, y0: number, x1: number, y1: number) =>
      Array.from({ length: steps + 1 }, (_, i) => at(x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps));
    const outline = [edge(-hw, 0.5, hw, 0.5), edge(hw, 0.5, hw, -0.5), edge(hw, -0.5, -hw, -0.5), edge(-hw, -0.5, -hw, 0.5)];
    // The face itself: a 9 by 9 grid of card points (s across, t down, 0..1).
    const grid = Array.from({ length: 81 }, (_, i) => {
      const s = (i % 9) / 8;
      const t = Math.floor(i / 9) / 8;
      return { s, t, ...at((s - 0.5) * COIL.cardAspect, 0.5 - t) };
    });
    return {
      quad: projectQuad(pose, camera, origin),
      flatQuad: projectQuad({ ...pose, bend: 0 }, camera, origin),
      center: at(0, 0),
      outline,
      grid,
    };
  }

  function slotInfo(j: number) {
    const slot = slots[j];
    const pose = st.rendered[j];
    const drawn = pose ? poseInfo(pose) : null;
    if (!slot || !pose || !drawn) return null;
    const tile = tiles[slot.tile];
    return {
      ...drawn,
      slot: j,
      key: tile?.key,
      kind: tile?.kind,
      hover: slot.hover,
      hovered: st.hoveredSlot === j,
      hidden: st.hiddenSlot === j,
      u: pose.u,
      depth: pose.depth,
      fade: pose.fade,
      alpha: pose.alpha,
      scale: pose.scale,
      bend: pose.bend,
      beta: pose.beta,
      uniforms: {
        uBend: slot.uniforms.uBend.value,
        uFade: slot.uniforms.uFade.value,
        uBright: slot.uniforms.uBright.value,
        uShade: slot.uniforms.uShade.value,
        uSeen: slot.uniforms.uSeen.value,
        uAlpha: slot.uniforms.uAlpha.value,
      },
    };
  }

  // What every mark carries: the conveyor, the hover, the freeze and the followed slot.
  function state() {
    const followed = probeSlot >= 0 ? slots[probeSlot] : null;
    const pose = probeSlot >= 0 ? st.rendered[probeSlot] : null;
    return {
      offset: st.conveyor.offset,
      target: st.conveyor.target,
      glide: st.conveyor.glide !== null,
      envelope: st.envelope.value,
      hoveredSlot: st.hoveredSlot,
      hiddenSlot: st.hiddenSlot,
      frozenByApi: st.frozenByApi,
      frozenByProps: live.current.frozen,
      looping: st.raf !== 0,
      slot: probeSlot,
      hover: followed?.hover ?? null,
      scale: pose?.scale ?? null,
      fade: pose?.fade ?? null,
      bright: followed?.uniforms.uBright.value ?? null,
      seen: followed?.uniforms.uSeen.value ?? null,
    };
  }

  // window.__coilFlight.scene: the slot hooks.
  function install() {
    if (!flightLog) return;
    flightLog.scene = {
      state,
      follow: ((j: number) => {
        probeSlot = j;
      }) as never,
      slot: slotInfo as never,
      slots: () =>
        Array.from({ length: st.geo?.slotCount ?? 0 }, (_, j) => slotInfo(j)).filter(
          (info) => info !== null && info.alpha > 0.5,
        ),
      // Shows or hides a slot's mesh and redraws, with no other side effect.
      hide: ((j: number | null) => {
        st.hiddenSlot = j;
        if (!st.raf) {
          loop.update(0, performance.now());
          loop.render(0);
        }
      }) as never,
      seam: () => FIELD.seamFade,
    };
  }

  // window.__coilFlight.scene: the flown card as last drawn (its corners,
  // its outline and its face grid) and the flight's state.
  function installFlight(current: () => FlightView | null) {
    if (!flightLog) return;
    flightLog.scene.flown = () => {
      const flight = current();
      return flight?.pose ? poseInfo(flight.pose) : null;
    };
    flightLog.scene.flight = () => {
      const flight = current();
      return flight ? { slot: flight.slot, state: flight.state, gap: flight.gap, pose: flight.pose } : null;
    };
  }

  return { state, install, installFlight };
}

export type Probe = ReturnType<typeof createProbe>;
