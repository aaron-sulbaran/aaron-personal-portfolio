// The Coil scene's frame order. The scene's modules each own some of these
// steps; the loop runs them through these two sequencers, so the order is one
// place and a unit test holds it (frame.test.ts). F is the scene's per-frame
// record (dt, now, the props as the frame began, and what earlier steps hand
// later ones: the helix, the entrance clock, the rebuild fade, the unwind's
// progress).
//
// Update: scroll delta, conveyor (idle, wheel, page scroll; one smoothing
// stage and the spin cap; the stretch envelope), helix frame, entrance (the
// strand held until the band opens; the name's fade), rebuild fade, unwind
// (latch, column, overlay fades, the name's move), name (the surface's clock
// and the pointer's wake), seen levels, slots (pose, entrance, unwind, header
// band, rebuild, hidden slot, hover lift, seen ring), silhouette, picking,
// nudge, repaint. Render: field (only when its clock moved), surface (the
// name's lit surface, only while the name shows), composite, cards.

export type UpdateSteps<F> = {
  scroll: (frame: F) => void;
  conveyor: (frame: F) => void;
  helix: (frame: F) => void;
  entrance: (frame: F) => void;
  rebuild: (frame: F) => void;
  unwind: (frame: F) => void;
  name: (frame: F) => void;
  seen: (frame: F) => void;
  slots: (frame: F) => void;
  silhouette: (frame: F) => void;
  picking: (frame: F) => void;
  nudge: (frame: F) => void;
  repaint: (frame: F) => void;
};

export type RenderSteps<F> = {
  field: (frame: F) => void;
  surface: (frame: F) => void;
  composite: (frame: F) => void;
  cards: (frame: F) => void;
};

export function runUpdate<F>(steps: UpdateSteps<F>, frame: F) {
  steps.scroll(frame);
  steps.conveyor(frame);
  steps.helix(frame);
  steps.entrance(frame);
  steps.rebuild(frame);
  steps.unwind(frame);
  steps.name(frame);
  steps.seen(frame);
  steps.slots(frame);
  steps.silhouette(frame);
  steps.picking(frame);
  steps.nudge(frame);
  steps.repaint(frame);
}

export function runRender<F>(steps: RenderSteps<F>, frame: F) {
  steps.field(frame);
  steps.surface(frame);
  steps.composite(frame);
  steps.cards(frame);
}
