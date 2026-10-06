"use client";

import { Component, useEffect, useState, type ComponentType, type ReactNode } from "react";
import type { WaveBehindProps } from "./WaveBehind";

// Mounts the wave behind the sections without letting it break the page: a
// failed import or a thrown render shows nothing and reports "failed", and
// the panel's retry imports again.

class Boundary extends Component<{ onFail: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFail();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function WaveSlot({ attempt, onFail, ...props }: WaveBehindProps & { attempt: number; onFail: () => void }) {
  const [Loaded, setLoaded] = useState<ComponentType<WaveBehindProps> | null>(null);
  useEffect(() => {
    let live = true;
    import("./WaveBehind")
      .then((mod) => live && setLoaded(() => mod.default))
      .catch(() => live && onFail());
    return () => {
      live = false;
    };
  }, [attempt, onFail]);
  if (!Loaded) return null;
  return (
    <Boundary key={attempt} onFail={onFail}>
      <Loaded {...props} />
    </Boundary>
  );
}
