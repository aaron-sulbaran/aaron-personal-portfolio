"use client";

import { Component, type ReactNode } from "react";

// Around the scene chunk: a thrown scene renders nothing, so the poster under
// it and the server-rendered h1 carry the hero, and the book below keeps
// working. The stage owns the context-loss remount (once); this only catches.
type Props = { children: ReactNode; onError: (error: unknown) => void };
type State = { failed: boolean };

export class CoilErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    this.props.onError(error);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
