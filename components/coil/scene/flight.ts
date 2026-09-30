import { COIL } from "@/lib/coil/constants";
import {
  flightPoseAt,
  handoff,
  poseGap,
  seatPose,
  slotPose,
  type FlightPose,
  type HandoffAction,
  type HandoffEvent,
  type HandoffState,
  type Rect,
} from "@/lib/coil/flight";
import { projectQuad, type Quad } from "@/lib/coil/geometry";
import { HOVER_RATE, type Cards } from "./cards";
import type { Probe } from "./debugProbe";
import type { FlightOverlay, Overlay } from "./flightOverlay";
import type { Hover } from "./hover";
import type { LoopLink, SceneCtx } from "./state";
import type { CoilFlightHandle } from "./types";

// ---- fx-flight: the flown card ----
// A clicked card flies into its modal as itself. The scene draws that one
// card with the card shader (its bend, its shading, its lift, the seam, the
// seen ring, and the cards that cover it) into a second canvas mounted above
// the modal (flightOverlay.ts), so the frame the mesh hides and the frame it
// shows again are the same pixels drawn twice. Between the seat and the slot
// the pose is flightPoseAt(): the card travels and turns as a body while the
// bend flattens and the shading releases. The order of every swap is
// handoff() (lib/coil/flight.ts). The scene freezes for the flight and
// resumes itself on the frame after the landing.

type Flight = {
  slot: number;
  state: HandoffState;
  alpha: number; // the mesh's own alpha on its seat (the hidden mesh reads 0)
  e: number; // as last drawn
  rect: Rect | null; // the slot, as last given
  lastSlot: FlightPose | null;
  pose: FlightPose | null; // as last drawn
  gap: number; // how far the last drawn pose was from the seat
};

export function createFlight(
  ctx: SceneCtx,
  cards: Cards,
  hover: Hover,
  overlay: FlightOverlay,
  probe: Probe,
  loop: LoopLink,
) {
  const { st, host, live, flightLog } = ctx;
  const { view, rendered } = st;
  const { slots, shared } = cards;
  let flight: Flight | null = null;
  let prewarm = 0;

  // api.freeze: stops (true) or resumes (false) rendering at once; the last frame stays.
  function freeze(on: boolean) {
    flightLog?.mark(on ? "freeze" : "unfreeze", probe.state()); // fx-flight debug
    st.frozenByApi = on;
    if (on) loop.stop();
    else loop.wake();
  }

  // api.hideSlot: hides one slot's mesh (the flown card) or none.
  function hideSlot(slot: number | null) {
    flightLog?.mark(slot === null ? "mesh-show" : "mesh-hide", { slot }); // fx-flight debug
    st.hiddenSlot = slot;
    if (!st.raf) loop.renderStill();
  }

  // The card on its seat, as the scene would draw it now.
  function seatOf(f: Flight): FlightPose | null {
    const pose = rendered[f.slot];
    const slot = slots[f.slot];
    if (!pose || !slot) return null;
    return seatPose(
      { ...pose, alpha: f.alpha },
      {
        bright: slot.uniforms.uBright.value,
        shade: slot.uniforms.uShade.value,
        sheen: shared.uSheen.value,
        seen: slot.uniforms.uSeen.value,
      },
    );
  }

  function still() {
    loop.update(0, st.lastTime);
    loop.render(0);
    flightLog?.mark("scene-still", probe.state());
  }

  function act(f: Flight, event: HandoffEvent) {
    const next = handoff(f.state, event);
    f.state = next.state;
    next.actions.forEach((action: HandoffAction) => {
      if (action === "draw-card") {
        const seat = seatOf(f);
        const o = overlay.liveOverlay();
        if (seat && o) {
          f.pose = seat;
          f.gap = 0;
          overlay.drawFlown(o, f.slot, seat);
          flightLog?.mark("clone-mount", { slot: f.slot });
        }
      } else if (action === "hide-mesh") {
        flightLog?.mark("mesh-hide", { slot: f.slot });
        st.hiddenSlot = f.slot;
        still();
      } else if (action === "show-mesh") {
        flightLog?.mark("mesh-show", { slot: f.slot, gap: f.gap });
        st.hiddenSlot = null;
        still();
      } else if (action === "clear-card") {
        overlay.clear();
        flightLog?.mark("clone-unmount", { slot: f.slot });
      } else if (action === "resume") {
        // The loop is already stepping this frame (one frame's step, see wake).
        flightLog?.mark("unfreeze", probe.state());
      }
    });
  }

  function layoutStamp() {
    const rect = host.getBoundingClientRect();
    return [view.width, view.height, view.dpr, rect.left, rect.top].join(",");
  }

  // The flown card at its progress, between the seat as the scene would draw
  // it now and the slot as last given. Returns the flat card's corners.
  function flightDraw(f: Flight, o: Overlay): Quad | null {
    if (!st.geoCamera || f.state === "landed" || f.state === "rest") return null;
    const seat = seatOf(f);
    if (!seat) return null;
    const rect = host.getBoundingClientRect();
    const origin = { left: rect.left, top: rect.top };
    if (f.rect) f.lastSlot = slotPose(st.geoCamera, f.rect, origin);
    const pose = flightPoseAt(seat, f.lastSlot ?? seat, f.e);
    f.pose = pose;
    f.gap = poseGap(pose, seat);
    overlay.drawFlown(o, f.slot, pose);
    return projectQuad({ ...pose, bend: 0 }, st.geoCamera, origin);
  }

  // The scene drew a still frame (a resize re-laid it out): the card in
  // flight is drawn again through the new layout, in the same frame.
  function flightStill() {
    if (!flight || !flight.pose) return;
    const o = overlay.drawable();
    if (o) flightDraw(flight, o);
  }

  // The frame after a landing is the scene's first live one.
  function flightFrame() {
    if (!flight || flight.state !== "landed") return;
    act(flight, "frame");
    flight = null;
  }

  // api.beginFlight: mounts the flown card's canvas in `mount`, draws the
  // card on its seat and hides the mesh before it returns.
  function beginFlight(slot: number, mount: HTMLElement): CoilFlightHandle | null {
    const pose = rendered[slot];
    if (!st.ready || st.contextLost || st.disposed || !st.geoCamera || !pose || !slots[slot] || pose.alpha <= 0.01) return null;
    const o = overlay.liveOverlay();
    if (!o) return null;
    if (flight) act(flight, "abort");
    st.frozenByApi = true;
    st.landedAhead = false;
    loop.stop();
    const f: Flight = { slot, state: "rest", alpha: pose.alpha, e: 0, rect: null, lastSlot: null, pose: null, gap: 0 };
    flight = f;
    mount.appendChild(o.canvas);
    act(f, "open");
    if (!f.pose) {
      flight = null;
      return null;
    }
    const finish = (event: "land" | "abort") => {
      if (flight !== f || (f.state !== "home" && event === "land")) return;
      act(f, event);
      if (f.state !== "landed") return;
      // A landing resumes the scene itself, on the next frame, ahead of
      // the props (the modal has closed; the flight was the one thing
      // holding it). A flight torn down under an open modal stays frozen.
      st.frozenByApi = false;
      st.landedAhead = event === "land";
      loop.wake();
      // No frame to come (a modal is open, the hero is off screen): done.
      if (!st.raf) {
        act(f, "frame");
        flight = null;
      }
    };
    return {
      draw(e, rect, dt) {
        if (flight !== f || overlay.liveOverlay() !== o) return null;
        if (f.state === "home" && dt > 0) {
          // The lift follows the pointer on the way home, at the scene's
          // own rate, so the card lands as the scene would draw it next.
          const lifted = slots[f.slot];
          lifted.hover += (hover.liftTarget(f.slot, f.alpha) - lifted.hover) * (1 - Math.exp(-Math.min(dt, COIL.lab.maxFrameSeconds) * HOVER_RATE));
          loop.update(0, st.lastTime);
        }
        f.e = e;
        if (rect) f.rect = rect;
        return flightDraw(f, o);
      },
      stamp: layoutStamp,
      arrive() {
        if (flight === f) act(f, "arrive");
      },
      close() {
        if (flight === f) act(f, "close");
      },
      land() {
        flightLog?.mark("clone-landed", { slot: f.slot, gap: f.gap });
        finish("land");
      },
      abort() {
        finish("abort");
      },
    };
  }

  // The flown canvas and its program are made ahead of the first click.
  function warm() {
    prewarm = window.setTimeout(() => {
      prewarm = 0;
      // Only a fine pointer flies cards (a tap opens its modal directly).
      if (st.disposed || st.contextLost || overlay.exists() || live.current.input !== "fine") return;
      const o = overlay.liveOverlay();
      if (o) o.renderer.compile(o.scene, o.camera);
    }, 1200);
  }

  function dispose() {
    if (prewarm) window.clearTimeout(prewarm);
    overlay.dispose();
    flight = null;
  }

  // QA: the flight as last drawn.
  function current() {
    return flight;
  }

  return { freeze, hideSlot, beginFlight, flightStill, flightFrame, warm, dispose, current };
}

export type FlightWiring = ReturnType<typeof createFlight>;
