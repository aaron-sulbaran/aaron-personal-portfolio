"use client";

import { useEffect, useState } from "react";
import type { FooterSettings, TypeResponse } from "./settings";
import { measureFace, type TypeMetrics } from "./typeMetrics";
import { fontPose, loadWebFont, variationSettings, type AxisValues, type WebFontInfo } from "./webFont";

// The wordmark's face, resolved: the procedural alphabet, or a typeset face
// (Profa Black, or a web font) once it has loaded and been measured. While
// a new pose of the same face is measured, the last one stays up, so a
// slider drag never blanks the word.

export type TypesetFace = {
  kind: "typeset";
  label: string;
  family: string; // a CSS font-family value
  restWeight: number; // CSS font-weight at rest and at the swell's end
  heavyWeight: number;
  rest: AxisValues; // the axes at rest and at the swell's end
  heavy: AxisValues;
  canSwell: boolean;
  metrics: TypeMetrics;
  info: WebFontInfo | null; // null for Profa
};

export type Typeface = { kind: "procedural" } | { kind: "loading"; label: string } | { kind: "failed"; label: string } | TypesetFace;

const PROFA_WEIGHT = 900;

// A swell needs an axis to move; a face without one grows instead.
export function effectiveResponse(asked: TypeResponse, face: TypesetFace | null): TypeResponse {
  if (!face) return "swell";
  return asked === "swell" && !face.canSwell ? "grow" : asked;
}

async function resolve(text: string, face: FooterSettings["face"], font: FooterSettings["font"]): Promise<Typeface> {
  if (face === "profa") {
    const family = getComputedStyle(document.documentElement).getPropertyValue("--font-display").trim();
    const pose = { weight: PROFA_WEIGHT, variation: "normal" };
    const metrics = family ? await measureFace(text, family, pose, pose) : null;
    if (!metrics) return { kind: "failed", label: "Profa Black" };
    return { kind: "typeset", label: "Profa Black", family, restWeight: PROFA_WEIGHT, heavyWeight: PROFA_WEIGHT, rest: {}, heavy: {}, canSwell: false, metrics, info: null };
  }
  const info = await loadWebFont(font.family);
  if (!info) return { kind: "failed", label: font.family };
  const pose = fontPose(info, font);
  const metrics = await measureFace(
    text,
    info.family,
    { weight: pose.cssWeight, variation: variationSettings(pose.rest) },
    { weight: pose.heavyCssWeight, variation: variationSettings(pose.heavy) },
  );
  if (!metrics) return { kind: "failed", label: font.family };
  return {
    kind: "typeset",
    label: info.family.replace(/"/g, ""),
    family: info.family,
    restWeight: pose.cssWeight,
    heavyWeight: pose.heavyCssWeight,
    rest: pose.rest,
    heavy: pose.heavy,
    canSwell: pose.canSwell,
    metrics,
    info,
  };
}

export function useTypeface(text: string, face: FooterSettings["face"], font: FooterSettings["font"]): Typeface {
  const family = face === "font" ? font.family : face;
  const key = face === "procedural" ? "procedural" : `${text}|${face}|${face === "font" ? JSON.stringify(font) : ""}`;
  const [done, setDone] = useState<{ key: string; family: string; face: Typeface } | null>(null);

  useEffect(() => {
    if (face === "procedural") return;
    let live = true;
    resolve(text, face, font).then((resolved) => {
      if (live) setDone({ key, family, face: resolved });
    });
    return () => {
      live = false;
    };
  }, [key, text, face, font, family]);

  if (face === "procedural") return { kind: "procedural" };
  if (done?.key === key) return done.face;
  if (done && done.family === family && done.face.kind === "typeset") return done.face;
  return { kind: "loading", label: face === "profa" ? "Profa Black" : font.family };
}
