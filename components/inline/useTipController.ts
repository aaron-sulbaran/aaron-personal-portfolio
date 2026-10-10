"use client";
import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, type RefObject } from "react";
import { markOpen } from "@/lib/inline/open";
import { anchorPosition, followPosition, type Size } from "@/lib/inline/placement";
import { sameTarget, TIP_GRACE_MS, TIP_IDLE, tipMode, tipReducer, type TipState, type TipTarget } from "@/lib/inline/tipState";
import { holdsLink } from "@/lib/inline/view";
import { isKeyboardFocus } from "@/lib/input/modality";
import { useEscapeKey } from "@/lib/modal";
const linkOf = (node: EventTarget | null) => (node instanceof Element ? node.closest<HTMLElement>('[data-inline="tip"], [data-inline="pop"]') : null);
function targetOf({ dataset: { inline: kind, inlineKey: key } }: HTMLElement): TipTarget | null {
  return (kind === "tip" || kind === "pop") && key ? { kind, key } : null;
}
const holdsOf = (target: TipTarget | null) => !!target && holdsLink(target.kind, target.key);
const BUBBLE_LINK = 'a[data-inline="external"]';
// The shared label's driver: delegated document listeners (the links are
// server markup), one reducer for who shows it, and the position written
// straight to the label's transform in the pointer handler, as CustomCursor
// does: a move never renders React and never reads layout.
export function useTipController(bubbleRef: RefObject<HTMLElement | null>): { state: TipState; dismiss: () => void } {
  const [state, dispatch] = useReducer(tipReducer, TIP_IDLE);
  const stateRef = useRef(state);
  const linkRef = useRef<HTMLElement | null>(null);
  const pointerRef = useRef({ x: 0, y: 0 });
  const sizeRef = useRef<Size>({ width: 0, height: 0 });
  // The pointerdown of the current gesture: a click is judged by its own press.
  const downRef = useRef<{ type: string; link: HTMLElement | null } | null>(null);
  // A re-split (SplitText) can remove an anchored label's link; the label goes.
  const place = useCallback(() => {
    const bubble = bubbleRef.current;
    const mode = tipMode(stateRef.current, holdsOf(stateRef.current.target));
    if (!bubble || !mode) return;
    const link = linkRef.current;
    const anchor = mode === "anchor" && link?.isConnected ? link.getBoundingClientRect() : null;
    if (mode === "anchor" && !anchor) { dispatch({ type: "dismiss" }); return; }
    const view = { width: window.innerWidth, height: window.innerHeight };
    const at = anchor ? anchorPosition(anchor, sizeRef.current, view) : followPosition(pointerRef.current, sizeRef.current, view);
    bubble.style.transform = `translate3d(${Math.round(at.x)}px, ${Math.round(at.y)}px, 0)`;
  }, [bubbleRef]);
  // One size read per shown target, never one per move. A fresh label lands
  // in place (a style flush with no data-trail) before it may trail a mouse.
  useLayoutEffect(() => {
    const fresh = !stateRef.current.target;
    stateRef.current = state;
    const bubble = bubbleRef.current;
    if (!bubble || !state.target) return;
    if (fresh) delete bubble.dataset.trail;
    sizeRef.current = { width: bubble.offsetWidth, height: bubble.offsetHeight };
    place();
    if (fresh) { bubble.getBoundingClientRect(); bubble.dataset.trail = ""; }
  }, [state, place, bubbleRef]);
  useEffect(() => {
    const show = (link: HTMLElement, type: "hover" | "focus" | "press" | "tap") => {
      const target = targetOf(link);
      if (!target) return;
      if (tipReducer(stateRef.current, { type, target }) !== stateRef.current) linkRef.current = link;
      dispatch({ type, target });
    };
    const onPointerDown = (event: PointerEvent) => {
      const link = linkOf(event.target);
      downRef.current = { type: event.pointerType, link };
      const inBubble = event.target instanceof Node && !!bubbleRef.current?.contains(event.target);
      if (!link && !inBubble && stateRef.current.via === "tap") dispatch({ type: "dismiss" });
    };
    // A tip that holds a link keeps the pointer's way open: leaving the word or
    // the label starts the grace, arriving on either takes it back.
    const inBubble = (node: EventTarget | null) => node instanceof Node && !!bubbleRef.current?.contains(node);
    const onPointerOver = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      if (inBubble(event.target)) {
        const { target, via } = stateRef.current;
        if (target && holdsOf(target) && (via === "hover" || via === "grace")) dispatch({ type: "hover", target });
        return;
      }
      const link = linkOf(event.target);
      if (link) { pointerRef.current = { x: event.clientX, y: event.clientY }; show(link, "hover"); }
    };
    const onPointerOut = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const to = event.relatedTarget;
      if (inBubble(event.target)) {
        if (!inBubble(to) && !(to instanceof Node && linkRef.current?.contains(to))) dispatch({ type: "leave" });
        return;
      }
      const link = linkOf(event.target);
      if (!link || (to instanceof Node && link.contains(to))) return;
      const holds = holdsOf(targetOf(link));
      if (holds && inBubble(to)) return;
      dispatch({ type: holds ? "leave" : "unhover" });
    };
    // A re-split removes the hovered link without a pointerout; the next move
    // off any link lets the label go (one dispatch: the state is then idle).
    const onPointerMove = (event: PointerEvent) => {
      pointerRef.current = { x: event.clientX, y: event.clientY };
      if (tipMode(stateRef.current, holdsOf(stateRef.current.target)) !== "follow") return;
      if (linkOf(event.target)) place(); // a write, never a render
      else dispatch({ type: "unhover" });
    };
    const onFocusIn = (event: FocusEvent) => { const link = linkOf(event.target); if (link && isKeyboardFocus(link)) show(link, "focus"); };
    // Focus moving between a linked tip's word and its label keeps the tip open.
    const onFocusOut = (event: FocusEvent) => {
      const to = event.relatedTarget;
      if (linkOf(event.target)) {
        if (!inBubble(to)) dispatch({ type: "blur" });
      } else if (inBubble(event.target) && !(to instanceof Node && linkRef.current?.contains(to))) dispatch({ type: "blur" });
    };
    // Tab from a linked tip's word reaches its label's link; Shift+Tab from the
    // link goes back to the word, and Tab from it carries on from the word.
    // Handled before the dialog's own trap, which would pull the label's focus in.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const { target, via } = stateRef.current;
      const labelLink = bubbleRef.current?.querySelector<HTMLElement>(BUBBLE_LINK);
      const word = linkRef.current;
      if (!target || !holdsOf(target) || !labelLink || !word) return;
      if (!event.shiftKey && via === "focus" && document.activeElement === word) {
        event.preventDefault();
        event.stopPropagation();
        labelLink.focus({ preventScroll: true });
      } else if (document.activeElement === labelLink) {
        if (event.shiftKey) { event.preventDefault(); event.stopPropagation(); }
        word.focus({ preventScroll: true });
      }
    };
    // A tap (any pointer but a mouse, pressed on this same link) pins the
    // label, holding a pop's href; a second tap on a pinned pop anchor follows
    // the href natively. Enter on a button toggles the label. A mouse click,
    // Enter on an anchor, and a click with no pointerdown of its own (assistive
    // tech) follow the href natively.
    const onClick = (event: MouseEvent) => {
      const down = downRef.current;
      downRef.current = null;
      const link = linkOf(event.target);
      if (!link) return;
      if (event.detail !== 0 && down?.link === link && down.type !== "mouse") {
        const { target, via } = stateRef.current;
        if (via === "tap" && sameTarget(target, targetOf(link)) && link.tagName === "A") { dispatch({ type: "dismiss" }); return; }
        event.preventDefault();
        show(link, "tap");
      } else if (event.detail === 0 && link.tagName !== "A") show(link, "press");
    };
    const onScroll = () => (stateRef.current.via === "hover" ? dispatch({ type: "dismiss" }) : place());
    const onDocument: Array<[string, EventListener, AddEventListenerOptions]> = [
      ["pointerdown", onPointerDown as EventListener, { capture: true, passive: true }],
      ["pointerover", onPointerOver as EventListener, { passive: true }],
      ["pointerout", onPointerOut as EventListener, { passive: true }],
      ["pointermove", onPointerMove as EventListener, { passive: true }],
      ["focusin", onFocusIn as EventListener, {}],
      ["focusout", onFocusOut as EventListener, {}],
      ["keydown", onKeyDown as EventListener, { capture: true }],
      ["click", onClick as EventListener, {}],
    ];
    for (const [type, listener, options] of onDocument) document.addEventListener(type, listener, options);
    window.addEventListener("scroll", onScroll, { capture: true, passive: true });
    window.addEventListener("resize", place, { passive: true });
    return () => {
      for (const [type, listener, options] of onDocument) document.removeEventListener(type, listener, options);
      window.removeEventListener("scroll", onScroll, { capture: true });
      window.removeEventListener("resize", place);
    };
  }, [bubbleRef, place]);
  useEffect(() => {
    if (state.via !== "grace") return;
    const timer = window.setTimeout(() => dispatch({ type: "expire" }), TIP_GRACE_MS);
    return () => window.clearTimeout(timer);
  }, [state]);
  // The link whose label is showing keeps its underline filled, hover or not.
  useEffect(() => (state.target ? markOpen(linkRef.current) : undefined), [state]);
  const dismiss = useCallback(() => dispatch({ type: "dismiss" }), []);
  // Escape with focus on a linked tip's label hands focus back to its word first.
  const escape = useCallback(() => {
    if (bubbleRef.current?.contains(document.activeElement)) linkRef.current?.focus({ preventScroll: true });
    dispatch({ type: "dismiss" });
  }, [bubbleRef]);
  useEscapeKey(state.target !== null, escape);
  return { state, dismiss };
}
