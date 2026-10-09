"use client";

import { useEffect } from "react";
import { trackModality } from "@/lib/input/modality";

// Mounts the input modality tracker (lib/input/modality): data-input on <html>
// says whether the last input was a press or a key, and globals.css paints a
// focus ring only while it is not a press.
export function InputModality() {
  useEffect(() => trackModality(), []);
  return null;
}
