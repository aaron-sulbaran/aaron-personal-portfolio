"use client";

import { Component, type ReactNode } from "react";

// Around each non-essential mount in the root layout (player, cursor, inline
// layer, quests, transition): one that throws renders nothing, so a broken
// extra drops out instead of replacing the whole document with the global
// error page. The chrome and the page itself stay outside it.
type Props = { children: ReactNode };
type State = { failed: boolean };

export class QuietBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
