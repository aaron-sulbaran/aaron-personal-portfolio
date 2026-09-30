import {
  CanvasTexture,
  Color,
  DataTexture,
  DoubleSide,
  GreaterDepth,
  LinearFilter,
  LinearSRGBColorSpace,
  Mesh,
  PerspectiveCamera,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  UnsignedByteType,
  Vector2,
  Vector4,
  WebGLRenderer,
  type Texture,
} from "three";
import { COIL } from "@/lib/coil/constants";
import { FIELD } from "@/lib/coil/field.glsl";
import type { FlightPose } from "@/lib/coil/flight";
import { CARD_VERT, createCardMaterial, type CardUniforms, type SharedCardUniforms } from "@/lib/coil/material";
import type { Cards } from "./cards";
import type { Gl } from "./renderer";
import type { SceneCtx } from "./state";

// The flown card's canvas (fx-flight): a second WebGL canvas, mounted in a
// fixed layer above the modal, on the scene canvas's own pixel grid and
// through a window of the scene camera's projection, so the card shader draws
// the same pixels there as in the coil. It holds the flown card, the same
// card again where a nearer card covers it (fading in as the card leaves),
// and depth-only covers for the nearer cards. Made ahead of the first click,
// torn down with the scene, remade after a lost context.

const COVER_FRAG = /* glsl */ `
    uniform sampler2D mapF;
    varying vec2 vUv; varying vec3 vN; varying vec3 vViewPos;
    void main() {
      if (texture2D(mapF, vUv).a < 0.5) discard;
      gl_FragColor = vec4(0.0);
    }
  `;

type Cover = { mesh: Mesh; uBend: { value: number }; uAxis: { value: Vector2 }; mapF: { value: Texture | null } };

export type Overlay = {
  canvas: HTMLCanvasElement;
  renderer: WebGLRenderer;
  camera: PerspectiveCamera;
  scene: Scene;
  shared: SharedCardUniforms;
  card: Mesh;
  cardUniforms: CardUniforms;
  under: Mesh;
  underAlpha: { value: number };
  covers: Cover[];
  field: DataTexture | null;
  fitted: string;
  origin: { left: number; top: number };
  faces: Map<number, { of: Texture; front: Texture; back: Texture }>;
  lost: boolean;
  onLost: () => void;
};

// The largest whole offset (in buffer px) up to `most` that is also a
// whole number of device px; 0 when there is none near.
function gridOffset(most: number, devicePerBuffer: number) {
  const from = Math.floor(most);
  for (let k = from; k > 0 && k > from - 64; k--) {
    const onDevice = k * devicePerBuffer;
    if (Math.abs(onDevice - Math.round(onDevice)) < 1e-4) return k;
  }
  return 0;
}

// The smallest whole size (in buffer px) from `least` up that is also a
// whole number of device px, so the browser scales both canvases alike.
function gridSize(least: number, devicePerBuffer: number) {
  const from = Math.max(1, Math.ceil(least));
  for (let k = from; k < from + 64; k++) {
    const onDevice = k * devicePerBuffer;
    if (Math.abs(onDevice - Math.round(onDevice)) < 1e-4) return k;
  }
  return from;
}

export function createFlightOverlay(ctx: SceneCtx, gl: Gl, cards: Cards) {
  const { st, host } = ctx;
  const { renderer, camera, fieldTarget } = gl;
  const { cardGeometry, faces, slots, shared, placeMesh } = cards;
  let overlay: Overlay | null = null;

  function createOverlay(): Overlay | null {
    try {
      const flownCanvas = document.createElement("canvas");
      const flownRenderer = new WebGLRenderer({
        canvas: flownCanvas,
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
      flownRenderer.outputColorSpace = LinearSRGBColorSpace;
      flownRenderer.setClearColor(new Color(0, 0, 0), 0);
      flownRenderer.autoClear = false;
      flownRenderer.setPixelRatio(1);
      flownCanvas.style.position = "fixed";
      flownCanvas.style.pointerEvents = "none";
      flownCanvas.style.display = "block";
      const flownShared: SharedCardUniforms = {
        uField: { value: null },
        uView: { value: new Vector4(0, 0, 1, 1) },
        uInk: { value: new Color() },
        uPaper: { value: new Color() },
        uSheen: { value: 0 },
        uSeam: { value: FIELD.seamFade },
      };
      const geometry = cardGeometry;
      // The card: blended, so its soft edge and its alpha show over the modal;
      // at full alpha it writes exactly what the coil's opaque card writes.
      const { material, uniforms } = createCardMaterial(flownShared);
      material.transparent = true;
      material.depthWrite = true;
      const card = new Mesh(geometry, material);
      card.frustumCulled = false;
      card.renderOrder = 1;
      // The same card again, only where a nearer card covers it, fading in
      // as the card leaves the coil.
      const underAlpha = { value: 0 };
      const under = new Mesh(
        geometry,
        new ShaderMaterial({
          vertexShader: material.vertexShader,
          fragmentShader: material.fragmentShader,
          side: DoubleSide,
          transparent: true,
          depthWrite: false,
          depthFunc: GreaterDepth,
          uniforms: { ...(uniforms as unknown as Record<string, { value: unknown }>), uAlpha: underAlpha },
        }),
      );
      under.frustumCulled = false;
      under.renderOrder = 2;
      const flownScene = new Scene();
      flownScene.add(card, under);
      const created: Overlay = {
        canvas: flownCanvas,
        renderer: flownRenderer,
        camera: new PerspectiveCamera(COIL.camera.fovDeg, 1, 0.1, 100),
        scene: flownScene,
        shared: flownShared,
        card,
        cardUniforms: uniforms,
        under,
        underAlpha,
        covers: [],
        field: null,
        fitted: "",
        origin: { left: 0, top: 0 },
        faces: new Map(),
        lost: false,
        onLost: () => {
          created.lost = true;
        },
      };
      flownCanvas.addEventListener("webglcontextlost", created.onLost);
      return created;
    } catch {
      return null;
    }
  }

  function disposeOverlay(o: Overlay) {
    o.canvas.removeEventListener("webglcontextlost", o.onLost);
    o.canvas.remove();
    o.faces.forEach((face) => {
      face.front.dispose();
      face.back.dispose();
    });
    (o.card.material as ShaderMaterial).dispose();
    (o.under.material as ShaderMaterial).dispose();
    o.covers.forEach((cover) => (cover.mesh.material as ShaderMaterial).dispose());
    o.field?.dispose();
    o.renderer.dispose();
    o.renderer.forceContextLoss();
  }

  // The overlay, made (or remade after a lost context) on demand.
  function liveOverlay() {
    if (overlay?.lost) {
      disposeOverlay(overlay);
      overlay = null;
    }
    overlay ??= createOverlay();
    return overlay;
  }

  // The flown card's own copies of a tile's two faces (a texture belongs to
  // the context that uploaded it), repainted faces included.
  function flownFaces(o: Overlay, tile: number) {
    const of = faces[tile].front;
    const held = o.faces.get(tile);
    if (held && held.of === of) return held;
    held?.front.dispose();
    held?.back.dispose();
    const copy = (source: Texture) => {
      const texture = new CanvasTexture(source.image as HTMLCanvasElement);
      texture.anisotropy = Math.min(8, o.renderer.capabilities.getMaxAnisotropy());
      return texture;
    };
    const next = { of, front: copy(faces[tile].front), back: copy(faces[tile].back) };
    o.faces.set(tile, next);
    return next;
  }

  // The flown canvas covers the viewport, a whole number of the scene
  // canvas's buffer pixels from its origin, and looks through a window of the
  // scene camera's own projection: the two canvases share one pixel grid.
  function fitOverlay(o: Overlay) {
    if (!st.geoCamera) return;
    const rect = host.getBoundingClientRect();
    const buffer = renderer.getDrawingBufferSize(new Vector2());
    const sx = buffer.x / st.view.width;
    const sy = buffer.y / st.view.height;
    // Both canvases also land on the same device pixels: the offset is a
    // whole number of device pixels too, or none at all.
    const device = window.devicePixelRatio || 1;
    const kx = gridOffset(-rect.left * sx, device / sx);
    const ky = gridOffset(-rect.top * sy, device / sy);
    const left = rect.left + kx / sx;
    const top = rect.top + ky / sy;
    const width = gridSize((window.innerWidth - left) * sx, device / sx);
    const height = gridSize((window.innerHeight - top) * sy, device / sy);
    o.origin = { left: rect.left, top: rect.top };
    const fitted = [left, top, width, height, buffer.x, buffer.y, st.view.width, st.view.height, st.lastFieldTime].join(",");
    if (fitted === o.fitted) return;
    o.fitted = fitted;
    o.renderer.setSize(width, height, false);
    o.canvas.style.left = `${left}px`;
    o.canvas.style.top = `${top}px`;
    o.canvas.style.width = `${width / sx}px`;
    o.canvas.style.height = `${height / sy}px`;
    o.camera.fov = camera.fov;
    o.camera.aspect = camera.aspect;
    o.camera.position.copy(camera.position);
    o.camera.quaternion.copy(camera.quaternion);
    o.camera.setViewOffset(buffer.x, buffer.y, kx, ky, width, height);
    o.camera.updateMatrixWorld();
    (o.shared.uView.value as Vector4).set(kx / buffer.x, (buffer.y - ky - height) / buffer.y, 1 / buffer.x, 1 / buffer.y);
    // The field as the scene last drew it: the recede and the seam read it.
    const w = fieldTarget.width;
    const h = fieldTarget.height;
    const bytes = new Uint8Array(w * h * 4);
    renderer.readRenderTargetPixels(fieldTarget, 0, 0, w, h, bytes);
    o.field?.dispose();
    const field = new DataTexture(bytes, w, h, RGBAFormat, UnsignedByteType);
    field.minFilter = LinearFilter;
    field.magFilter = LinearFilter;
    field.needsUpdate = true;
    o.field = field;
    o.shared.uField.value = field;
    (o.shared.uInk.value as Color).copy(shared.uInk.value as Color);
    (o.shared.uPaper.value as Color).copy(shared.uPaper.value as Color);
    o.shared.uSeam.value = shared.uSeam.value;
  }

  // The cards nearer than the flown one, drawn to depth only at the poses the
  // scene last rendered: they cover the flown card as they covered the mesh.
  function placeCovers(o: Overlay, slot: number, on: boolean, mapF: Texture) {
    let used = 0;
    if (on && st.geo) {
      for (let j = 0; j < st.geo.slotCount; j++) {
        const pose = st.rendered[j];
        if (j === slot || !pose || pose.alpha < 0.995) continue;
        let cover = o.covers[used];
        if (!cover) {
          const uBend = { value: 0 };
          const uAxis = { value: new Vector2(0, 1) };
          const map = { value: null as Texture | null };
          const mesh = new Mesh(
            cardGeometry,
            new ShaderMaterial({
              vertexShader: CARD_VERT,
              fragmentShader: COVER_FRAG,
              side: DoubleSide,
              colorWrite: false,
              uniforms: { uBend, uAxis, mapF: map },
            }),
          );
          mesh.frustumCulled = false;
          mesh.renderOrder = 0;
          o.scene.add(mesh);
          cover = { mesh, uBend, uAxis, mapF: map };
          o.covers.push(cover);
        }
        placeMesh(cover.mesh, { ...pose } as FlightPose);
        cover.uBend.value = pose.bend;
        cover.uAxis.value.set(Math.sin(pose.beta), Math.cos(pose.beta));
        cover.mapF.value = mapF;
        cover.mesh.visible = true;
        used += 1;
      }
    }
    for (let i = used; i < o.covers.length; i++) o.covers[i].mesh.visible = false;
  }

  // The flown card at a pose, with the cards that cover it.
  function drawFlown(o: Overlay, slot: number, pose: FlightPose) {
    fitOverlay(o);
    const textures = flownFaces(o, slots[slot].tile);
    const u = o.cardUniforms;
    u.mapF.value = textures.front;
    u.mapB.value = textures.back;
    u.uBend.value = pose.bend;
    (u.uAxis.value as Vector2).set(Math.sin(pose.beta), Math.cos(pose.beta));
    u.uFade.value = pose.fade;
    u.uBright.value = pose.bright;
    u.uAlpha.value = pose.alpha;
    u.uSeen.value = pose.seen;
    u.uShade.value = pose.shade;
    u.uSeamMix.value = pose.seam;
    u.uSoft.value = pose.soft;
    o.shared.uSheen.value = pose.sheen;
    placeMesh(o.card, pose);
    placeMesh(o.under, pose);
    const covered = pose.reveal < 1;
    o.underAlpha.value = pose.alpha * pose.reveal;
    o.under.visible = covered && pose.reveal > 0;
    placeCovers(o, slot, covered, textures.front);
    o.renderer.setRenderTarget(null);
    o.renderer.clear();
    o.renderer.render(o.scene, o.camera);
  }

  // The flown card cleared and unmounted; its buffers go back until the next flight.
  function clear() {
    if (overlay && !overlay.lost) {
      overlay.renderer.setRenderTarget(null);
      overlay.renderer.clear();
      // Its buffers go back until the next flight.
      overlay.renderer.setSize(1, 1, false);
      overlay.fitted = "";
    }
    overlay?.canvas.remove();
  }

  // The drawn overlay, if there is one still able to draw.
  function drawable() {
    return overlay && !overlay.lost ? overlay : null;
  }

  function exists() {
    return overlay !== null;
  }

  function dispose() {
    if (overlay) disposeOverlay(overlay);
    overlay = null;
  }

  return { liveOverlay, drawFlown, clear, drawable, exists, dispose };
}

export type FlightOverlay = ReturnType<typeof createFlightOverlay>;
