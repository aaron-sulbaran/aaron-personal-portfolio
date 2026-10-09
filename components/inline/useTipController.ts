"use client";
import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, type RefObject } from "react";
import { anchorPosition, followPosition, type Size } from "@/lib/inline/placement";
import { sameTarget, TIP_IDLE, tipMode, tipReducer, type TipState, type TipTarget } from "@/lib/inline/tipState";
import { useEscapeKey } from "@/lib/modal";
const linkOf = (node: EventTarget | null) => (node instanceof Element ? node.closest<HTMLElement>('[data-inline="tip"], [data-inline="pop"]') : null);
function targetOf({ dataset: { inline: kind, inlineKey: key } }: HTMLElement): TipTarget | null {
  return (kind === "tip" || kind === "pop") && key ? { kind, key } : null;
}
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
    const mode = tipMode(stateRef.current);
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
      if (target) { linkRef.current = link; dispatch({ type, target }); }
    };
    const onPointerDown = (event: PointerEvent) => {
      const link = linkOf(event.target);
      downRef.current = { type: event.pointerType, link };
      const inBubble = event.target instanceof Node && !!bubbleRef.current?.contains(event.target);
      if (!link && !inBubble && stateRef.current.via === "tap") dispatch({ type: "dismiss" });
    };
    const onPointerOver = (event: PointerEvent) => {
      const link = event.pointerType === "mouse" ? linkOf(event.target) : null;
      if (link) { pointerRef.current = { x: event.clientX, y: event.clientY }; show(link, "hover"); }
    };
    const onPointerOut = (event: PointerEvent) => {
      const link = event.pointerType === "mouse" ? linkOf(event.target) : null;
      if (link && !(event.relatedTarget instanceof Node && link.contains(event.relatedTarget))) dispatch({ type: "unhover" });
    };
    // A re-split removes the hovered link without a pointerout; the next move
    // off any link lets the label go (one dispatch: the state is then idle).
    const onPointerMove = (event: PointerEvent) => {
      pointerRef.current = { x: event.clientX, y: event.clientY };
      if (tipMode(stateRef.current) !== "follow") return;
      if (linkOf(event.target)) place(); // a write, never a render
      else dispatch({ type: "unhover" });
    };
    const onFocusIn = (event: FocusEvent) => { const link = linkOf(event.target); if (link?.matches(":focus-visible")) show(link, "focus"); };
    const onFocusOut = (event: FocusEvent) => { if (linkOf(event.target)) dispatch({ type: "blur" }); };
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
  const dismiss = useCallback(() => dispatch({ type: "dismiss" }), []);
  useEscapeKey(state.target !== null, dismiss);
  return { state, dismiss };
}
