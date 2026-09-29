"use client";

import { useSyncExternalStore } from "react";

// Shared header state between the two layout-mounted pieces of chrome: the
// Menu pill (components/menu) and the header bar with the mark
// (components/SiteNav.tsx). A tiny module store, like lib/soundtrack.ts:
//
//   menuOpen      the pill is (or is becoming) the panel. SiteNav reads it to
//                 bring the mark back while headroom has it tucked away.
//   headerHidden  headroom has tucked the bar away on a scroll down. The pill
//                 reads it to tuck itself away with the bar.
//
// Closing goes through closeMenu(after): the pill plays its close, releases
// the scroll lock, then runs `after` (a section jump, say), so nothing scrolls
// under a locked body.

type Listener = () => void;

let menuOpen = false;
let headerHidden = false;
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

export function setHeaderHidden(next: boolean): void {
  if (headerHidden === next) return;
  headerHidden = next;
  emit();
}

const getHeaderHidden = () => headerHidden;
const serverFalse = () => false;

export function useMenuOpen(): boolean {
  return useSyncExternalStore(subscribe, getMenuOpen, serverFalse);
}

export function useHeaderHidden(): boolean {
  return useSyncExternalStore(subscribe, getHeaderHidden, serverFalse);
}
