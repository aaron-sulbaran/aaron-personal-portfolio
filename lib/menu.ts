"use client";

import { useSyncExternalStore } from "react";

// Shared state of the Menu (components/menu): whether the pill is (or is
// becoming) the panel. A tiny module store, like lib/soundtrack.ts.
//
// Closing goes through closeMenu(after): the pill plays its close, releases
// the scroll lock, then runs `after` (a section jump, say), so nothing scrolls
// under a locked body.

type Listener = () => void;

let menuOpen = false;
let afterClose: (() => void) | null = null;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getMenuOpen(): boolean {
  return menuOpen;
}

export function openMenu(): void {
  if (menuOpen) return;
  afterClose = null;
  menuOpen = true;
  emit();
}

export function closeMenu(after?: () => void): void {
  if (!menuOpen) {
    after?.();
    return;
  }
  afterClose = after ?? null;
  menuOpen = false;
  emit();
}

// The pill calls this once its close has finished and the lock is released.
export function takeAfterClose(): (() => void) | null {
  const next = afterClose;
  afterClose = null;
  return next;
}

const serverFalse = () => false;

export function useMenuOpen(): boolean {
  return useSyncExternalStore(subscribe, getMenuOpen, serverFalse);
}

