import { Vector2, WebGLRenderTarget, type ShaderMaterial, type Vector4 } from "three";
import { letterContrast, oklabL, type LetterContrast } from "@/lib/coil/letterContrast";
import type { Name } from "./name";
import type { Gl } from "./renderer";
import type { SceneCtx } from "./state";

// QA only (?coildebug): the name as the composite draws it, without the
// cards, read back for the per-letter readout (lib/coil/letterContrast.ts),
// and snapshots of its lightness so the suite can measure what a gesture
// changes inside the letters at one held clock. Nothing here runs unless a
// hook is called.

type Frame = {
  L: Float32Array;
  cover: Float32Array;
  width: number;
  height: number;
  split: number;
  glyphs: { x0: number; x1: number }[];
  scale: number;
};

export type NameDelta = { mean: number; p95: number; p99: number; max: number; letters: number };

const PAD_CSS = 32; // room for the field ring around the letters

export function createNameProbe(ctx: SceneCtx, gl: Gl, comp: ShaderMaterial, name: Name) {
  const { st } = ctx;
  const { renderer, compScene, orthoCamera } = gl;
  const snaps = new Map<string, Frame>();

  // The composite alone (field, name), drawn into a buffer-sized target so
  // gl_FragCoord maps as it does on screen, then the name's box read back.
  // lettersOnly: the lightness only where the mask covers (a snapshot's
  // cost stays well under a frame's 100ms step cap).
  function frame(lettersOnly = false): Frame | null {
    const lock = name.lockup();
    if (!lock || !st.ready) return null;
    const buffer = renderer.getDrawingBufferSize(new Vector2());
    const dpr = buffer.y / st.view.height;
    const rect = comp.uniforms.uNameRect.value as Vector4;
    const x0 = Math.max(0, Math.floor((rect.x - PAD_CSS) * dpr));
    const y0 = Math.max(0, Math.floor((rect.y - PAD_CSS) * dpr));
    const x1 = Math.min(buffer.x, Math.ceil((rect.x + rect.z + PAD_CSS) * dpr));
    const y1 = Math.min(buffer.y, Math.ceil((rect.y + rect.w + PAD_CSS) * dpr));
    const width = x1 - x0;
    const height = y1 - y0;
    if (width <= 0 || height <= 0) return null;
    const target = new WebGLRenderTarget(buffer.x, buffer.y, { depthBuffer: false });
    const bytes = new Uint8Array(width * height * 4);
    renderer.setRenderTarget(target);
    renderer.clear();
    renderer.render(compScene, orthoCamera);
    renderer.readRenderTargetPixels(target, x0, buffer.y - y1, width, height, bytes);
    renderer.setRenderTarget(null);
    target.dispose();
    // The mask's coverage on the same grid.
    const k = rect.z / lock.width; // the rect's CSS px per mask CSS px (the unwind scales it)
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const g = canvas.getContext("2d", { willReadFrequently: true });
    if (!g) return null;
    g.drawImage(lock.canvas, rect.x * dpr - x0, rect.y * dpr - y0, rect.z * dpr, rect.w * dpr);
    const alpha = g.getImageData(0, 0, width, height).data;
    const cover = new Float32Array(width * height);
    for (let i = 0; i < cover.length; i++) cover[i] = alpha[i * 4 + 3] / 255;
    const L = new Float32Array(width * height);
    for (let y = 0; y < height; y++) {
      const from = (height - 1 - y) * width; // GL rows run bottom up
      for (let x = 0; x < width; x++) {
        if (lettersOnly && cover[y * width + x] <= 0.98) continue;
        const i = (from + x) * 4;
        L[y * width + x] = oklabL(bytes[i], bytes[i + 1], bytes[i + 2]);
      }
    }
    return {
      L,
      cover,
      width,
      height,
      split: Math.round((rect.y + lock.split * k) * dpr - y0),
      glyphs: lock.glyphs.map(({ x0: a, x1: b }) => ({ x0: (rect.x + a * k) * dpr - x0, x1: (rect.x + b * k) * dpr - x0 })),
      scale: dpr,
    };
  }

  function contrast(): LetterContrast | null {
    const f = frame();
    return f ? letterContrast(f) : null;
  }

  function snap(key: string) {
    const f = frame(true);
    if (f) snaps.set(key, f);
    return !!f;
  }

  // |dL| between two snapshots over the name's letters (greeting excluded).
  function delta(a: string, b: string): NameDelta | null {
    const fa = snaps.get(a);
    const fb = snaps.get(b);
    if (!fa || !fb || fa.L.length !== fb.L.length) return null;
    const values: number[] = [];
    const firstRow = fa.split;
    for (let i = firstRow * fa.width; i < fa.L.length; i++) {
      if (fa.cover[i] > 0.98) values.push(Math.abs(fa.L[i] - fb.L[i]));
    }
    values.sort((p, q) => p - q);
    const at = (p: number) => values[Math.min(values.length - 1, Math.floor(values.length * p))] ?? Number.NaN;
    const mean = values.reduce((s, v) => s + v, 0) / Math.max(1, values.length);
    return { mean, p95: at(0.95), p99: at(0.99), max: values[values.length - 1] ?? Number.NaN, letters: values.length };
  }

  return { contrast, snap, delta, drop: (key: string) => snaps.delete(key), clear: () => snaps.clear() };
}

export type NameProbe = ReturnType<typeof createNameProbe>;
