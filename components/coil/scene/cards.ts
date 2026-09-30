import { CanvasTexture, Color, Matrix4, Mesh, ShaderMaterial, Vector2, Vector3, type Texture } from "three";
import { entrancePose, type EntranceClock } from "@/lib/coil/entrance";
import { FIELD } from "@/lib/coil/field.glsl";
import { isConvex } from "@/lib/coil/flight";
import {
  clamp01,
  coilPose,
  mod,
  projectQuad,
  restHelix,
  silhouette,
  smoothstep01,
  type Camera,
  type CardPose,
  type CoilGeometry,
  type HelixFrame,
  type Quad,
} from "@/lib/coil/geometry";
import { createCardGeometry, createCardMaterial, type CardUniforms, type SharedCardUniforms } from "@/lib/coil/material";
import { stretchedDy } from "@/lib/coil/motion";
import { paintCard, type CardSource } from "@/lib/coil/textures";
import { applyColor, createRepaintQueue } from "@/lib/coil/theme";
import { unwindPose } from "@/lib/coil/unwind";
import { getSeen } from "@/lib/home/seen";
import type { Gl } from "./renderer";
import type { SceneCtx } from "./state";
import type { CoilCardFaces } from "./types";

// The helix of cards: one mesh per slot (the strand's cards cycle through
// them as the conveyor turns), each card's two painted faces as textures
// (repainted a few per frame on a theme or budget change), the per slot pose
// with every modifier applied in order, the seen ring, the hover lift, the
// silhouette, and the card pass.

export const HOVER_RATE = 6.5; // 1/s, the lift's soft approach (no overshoot)
const SEEN_RATE = 8;
const HOVER_SCALE = 0.045;
const HOVER_BRIGHT = 0.05;
const HOVER_UNFADE = 0.6;
// A theme repaint starts no new card past this much of a frame (at most 4).
const REPAINT_BUDGET_MS = 6;

// Slice 7: how much of a card may show under a narrow pane's clear top band:
// 1 while its projected top edge stays a quarter card below the band, fading
// to 0 as that edge reaches it, so no card ever crosses the mark, the Menu
// pill or the greeting's line. Faded cards are never picked.
const HEADER_FADE_CARDS = 0.25;
function headerClearance(pose: CardPose, geo: CoilGeometry, camera: Camera) {
  if (pose.alpha <= 0.001) return 1;
  const quad = projectQuad(pose, camera);
  const top = Math.min(quad[0].y, quad[1].y, quad[2].y, quad[3].y);
  return smoothstep01(clamp01((top - geo.clearTopPx) / (HEADER_FADE_CARDS * geo.cardPx)));
}

export type Slot = { mesh: Mesh; uniforms: CardUniforms; tile: number; hover: number };

// A frame's card inputs, from the update steps before the slots.
type CardFrame = {
  dt: number;
  now: number;
  geo: CoilGeometry;
  camera: Camera;
  helix: HelixFrame | null;
  clock: EntranceClock | null;
  rebuilt: number;
  listProgress: number;
};

type NameFlow = { flowAlong: (dx: number, dy: number) => void; hide: () => void };

export function createCards(ctx: SceneCtx, gl: Gl) {
  const { st, host, tiles, tileCount, flags } = ctx;
  const { conveyor, poses, rendered, unwind } = st;
  const { posterMode, hideCards, hideName } = flags;
  const { renderer, camera, cardScene, fieldTarget, uView } = gl;

  const shared: SharedCardUniforms = {
    uField: { value: fieldTarget.texture },
    uView,
    uInk: { value: new Color() },
    uPaper: { value: new Color() },
    uSheen: { value: st.theme.card.sheen },
    uSeam: { value: FIELD.seamFade },
  };
  const cardGeometry = createCardGeometry();
  const slots: Slot[] = [];
  const faces: { front: Texture; back: Texture }[] = [];
  let sources: CardSource[] = [];
  const seenLevel = new Float32Array(tileCount);
  const tileIndex = new Map<string, number>(tiles.map((tile, i) => [tile.key, i]));

  function makeTexture(source: HTMLCanvasElement) {
    const texture = new CanvasTexture(source);
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return texture;
  }

  function ensureSlots(count: number) {
    while (slots.length < count) {
      const { material, uniforms } = createCardMaterial(shared);
      const mesh = new Mesh(cardGeometry, material);
      mesh.frustumCulled = false;
      cardScene.add(mesh);
      slots.push({ mesh, uniforms, tile: -1, hover: 0 });
    }
    slots.forEach((slot, j) => {
      slot.mesh.visible = j < count;
    });
  }

  function bindTile(slot: Slot, tile: number) {
    const face = faces[tile];
    if (slot.tile === tile && slot.uniforms.mapF.value === face.front && slot.uniforms.mapB.value === face.back) return;
    slot.tile = tile;
    slot.uniforms.mapF.value = face.front;
    slot.uniforms.mapB.value = face.back;
  }

  // A fresh canvas pair into fresh textures; the old pair is disposed.
  function paintTile(tile: number) {
    const painted = paintCard(sources[tile], st.theme, st.budget.textureSize);
    const previous = faces[tile];
    faces[tile] = { front: makeTexture(painted.front), back: makeTexture(painted.back) };
    slots.forEach((slot) => {
      if (slot.tile === tile) bindTile(slot, tile);
    });
    previous?.front.dispose();
    previous?.back.dispose();
  }
  const repaints = createRepaintQueue<number>(4);

  // Boot: the loaded sources, the seen levels as stored, every card painted.
  function setSources(loaded: CardSource[]) {
    sources = loaded;
    const seen = getSeen();
    tiles.forEach((tile, i) => {
      seenLevel[i] = seen.has(tile.key) ? 1 : 0;
    });
  }

  // Every card again, a few per frame (a theme or budget change).
  function repaintAll() {
    repaints.enqueue(tiles.map((_, i) => i));
  }

  function applyTheme() {
    applyColor(shared.uInk.value, st.theme.ink);
    applyColor(shared.uPaper.value, st.theme.paper);
    shared.uSheen.value = st.theme.card.sheen;
  }

  // ---- pose application
  const basis = new Matrix4();
  const bx = new Vector3();
  const by = new Vector3();
  const bz = new Vector3();

  function placeMesh(mesh: Mesh, pose: Pick<CardPose, "position" | "basis" | "scale">) {
    mesh.position.set(pose.position[0], pose.position[1], pose.position[2]);
    basis.makeBasis(bx.set(...pose.basis.x), by.set(...pose.basis.y), bz.set(...pose.basis.z));
    mesh.quaternion.setFromRotationMatrix(basis);
    mesh.scale.setScalar(pose.scale);
  }

  function applyPose(slot: Slot, pose: CardPose, bright: number) {
    const { mesh, uniforms } = slot;
    placeMesh(mesh, pose);
    uniforms.uBend.value = pose.bend;
    (uniforms.uAxis.value as Vector2).set(Math.sin(pose.beta), Math.cos(pose.beta));
    uniforms.uFade.value = pose.fade;
    uniforms.uBright.value = bright;
    uniforms.uAlpha.value = pose.alpha;
    const material = mesh.material as ShaderMaterial;
    const translucent = pose.alpha < 0.995;
    if (material.transparent !== translucent) {
      material.transparent = translucent;
      material.depthWrite = !translucent;
      material.needsUpdate = true;
    }
    mesh.visible = pose.alpha > 0.01;
  }

  // Update step: the helix frame the slots pose on, stretched by the envelope.
  function helix(f: { geo: CoilGeometry; helix: HelixFrame | null }) {
    const rest = restHelix(f.geo, st.theme.card.recede);
    f.helix = { ...rest, dy: stretchedDy(rest.dy, st.envelope) };
  }

  // Update step: the seen levels ease toward the store.
  function seen(f: { dt: number }) {
    const stored = getSeen();
    const seenStep = 1 - Math.exp(-f.dt * SEEN_RATE);
    for (let i = 0; i < tileCount; i++) {
      seenLevel[i] += ((stored.has(tiles[i].key) ? 1 : 0) - seenLevel[i]) * seenStep;
    }
  }

  // Update step: every slot's pose (the helix, the entrance, the unwind, the
  // narrow header band, the rebuild fade, the hidden slot), then the hover
  // lift and the seen ring.
  function poseSlots(f: CardFrame) {
    const { now, geo, listProgress, rebuilt } = f;
    const helix = f.helix as HelixFrame;
    const clock = f.clock as EntranceClock;
    const hoverStep = 1 - Math.exp(-f.dt * HOVER_RATE);
    for (let j = 0; j < geo.slotCount; j++) {
      const slot = slots[j];
      let pose: CardPose = coilPose(helix, j, conveyor.offset);
      const strandPosition = Math.round(pose.u - conveyor.offset);
      const tile = mod(strandPosition, tileCount);
      bindTile(slot, tile);
      pose = entrancePose(pose, { strandPosition, cardCount: tileCount }, geo, clock);
      if (listProgress > 0) pose = unwindPose(pose, tile, unwind, now, null);
      // ---- slice 7: the narrow pane's clear top band (header and greeting) ----
      if (geo.clearTopPx > 0 && listProgress < 1) {
        const clear = headerClearance(pose, geo, f.camera);
        if (clear < 1) pose = { ...pose, alpha: pose.alpha * (clear + (1 - clear) * listProgress) };
      }
      if (rebuilt < 1) pose = { ...pose, alpha: pose.alpha * rebuilt };
      // ---- end slice 7 ----
      if (posterMode || j === st.hiddenSlot) pose = { ...pose, alpha: 0 };
      poses[j] = pose;

      slot.hover += ((j === st.hoveredSlot ? 1 : 0) - slot.hover) * hoverStep;
      const lift = slot.hover > 0.001 ? slot.hover : 0;
      const shown: CardPose = lift
        ? { ...pose, scale: pose.scale * (1 + HOVER_SCALE * lift), fade: pose.fade * (1 - HOVER_UNFADE * lift) }
        : pose;
      rendered[j] = shown;
      applyPose(slot, shown, HOVER_BRIGHT * lift);
      // Unwound, the row's outline ring after the title is the one seen mark;
      // the card's own ring fades with the unwind, since at thumb size it
      // reads as a second, solid dot.
      slot.uniforms.uSeen.value = seenLevel[tile] * (1 - listProgress);
    }
  }

  // Update step: the helix's projected hull (wheel capture, the nudge, the
  // name's flow direction); QA can hide the cards and the name.
  function hull(f: CardFrame, name: NameFlow) {
    st.sil = silhouette(f.helix as HelixFrame, f.camera, poses);
    // ---- fx-hero: sand drifts along the helix's axis; QA can hide the cards ----
    if (st.sil) name.flowAlong(st.sil.dx, st.sil.dy);
    if (hideCards) for (let j = 0; j < f.geo.slotCount; j++) slots[j].mesh.visible = false;
    if (hideName) name.hide();
    // ---- end fx-hero ----
  }

  // Update step: queued repaints, within the frame's budget.
  function repaint() {
    repaints.drain(paintTile, REPAINT_BUDGET_MS);
  }

  // Render step: the cards over the composite, on a fresh depth buffer.
  function draw() {
    renderer.clearDepth();
    renderer.render(cardScene, camera);
  }

  function origin() {
    const rect = host.getBoundingClientRect();
    return { left: rect.left, top: rect.top };
  }

  // A slot's four bent corners in viewport px, as last rendered (lift included).
  function quadOf(slot: number): Quad | null {
    const pose = rendered[slot];
    if (!pose || !st.geoCamera) return null;
    return projectQuad(pose, st.geoCamera, origin());
  }

  // The flight's source: the bent corners, or the flat card's when a card
  // nearly edge on folds them concave.
  function flightQuadOf(slot: number): Quad | null {
    const pose = rendered[slot];
    if (!pose || !st.geoCamera) return null;
    const at = origin();
    const bent = projectQuad(pose, st.geoCamera, at);
    return isConvex(bent) ? bent : projectQuad({ ...pose, bend: 0 }, st.geoCamera, at);
  }

  function facesOf(slot: number): CoilCardFaces | null {
    const tile = slots[slot]?.tile ?? -1;
    const face = faces[tile];
    if (!face) return null;
    return { front: face.front.image as HTMLCanvasElement, back: face.back.image as HTMLCanvasElement };
  }

  // The slot showing a card: its latched copy while unwound, else the
  // front-most visible copy; -1 when none is on screen.
  function slotOfKey(key: string) {
    const tile = tileIndex.get(key);
    if (tile === undefined || !st.geo) return -1;
    let best = -1;
    let bestDepth = -Infinity;
    for (let j = 0; j < st.geo.slotCount; j++) {
      const pose = poses[j];
      if (!pose || slots[j].tile !== tile) continue;
      if (unwind.latched) {
        if (Math.round(pose.u - unwind.offset) === unwind.latched[tile]) return j;
        continue;
      }
      if (pose.alpha > 0.5 && pose.depth > bestDepth) {
        best = j;
        bestDepth = pose.depth;
      }
    }
    return best;
  }

  // QA: the texture sizes actually uploaded.
  function textureSizes() {
    return new Set(
      faces.map((face) => {
        const image = face.front.image as HTMLCanvasElement;
        return `${image.width}x${image.height}`;
      }),
    );
  }

  function dispose() {
    repaints.clear();
    faces.forEach((face) => {
      face.front.dispose();
      face.back.dispose();
    });
    slots.forEach((slot) => (slot.mesh.material as ShaderMaterial).dispose());
    cardGeometry.dispose();
  }

  return {
    shared,
    cardGeometry,
    slots,
    faces,
    tileIndex,
    ensureSlots,
    paintTile,
    setSources,
    repaintAll,
    applyTheme,
    placeMesh,
    helix,
    seen,
    poseSlots,
    hull,
    repaint,
    draw,
    quadOf,
    flightQuadOf,
    facesOf,
    slotOfKey,
    textureSizes,
    dispose,
  };
}

export type Cards = ReturnType<typeof createCards>;
