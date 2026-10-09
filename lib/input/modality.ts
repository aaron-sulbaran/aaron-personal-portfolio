// Which kind of input the visitor used last, so a focus ring paints for the
// keyboard only. Chrome decides :focus-visible by its own heuristics, and they
// leak in two ways: a script focus (a modal's first control, focus returning
// to the control that opened it) paints a ring when the click before it landed
// on something that cannot take focus, like the Coil canvas; and a ring a key
// press earned stays through the mouse clicks that follow it. The tracker
// writes data-input="pointer" on <html> after a press, and globals.css drops
// the ring while it is set. Unset (a fresh load, or the window coming back
// from the address bar) leaves the browser's own rule in charge, which is what
// a visitor tabbing in from outside the page needs.

export type Modality = "keyboard" | "pointer";

export const MODALITY_ATTRIBUTE = "data-input";

// A held modifier is not a move toward the keyboard. Escape is not either: it
// dismisses a card or the Menu that a mouse opened, and the focus it returns to
// the opener must not paint a ring for a visitor who never left the mouse. A
// keyboard visitor has already tabbed, so their modality is set.
const SILENT_KEYS = new Set(["Alt", "AltGraph", "CapsLock", "Control", "Fn", "Meta", "OS", "Shift", "Escape"]);

export type ModalityEvent = { type: string; key?: string };

export function nextModality(current: Modality | null, event: ModalityEvent): Modality | null {
  switch (event.type) {
    case "pointerdown":
      return "pointer";
    case "keydown":
      return event.key && !SILENT_KEYS.has(event.key) ? "keyboard" : current;
    case "blur":
      return null;
    default:
      return current;
  }
}

type AttributeHost = Pick<Element, "getAttribute" | "setAttribute" | "removeAttribute">;
type ListenerHost = Pick<EventTarget, "addEventListener" | "removeEventListener">;

function readModality(root: AttributeHost): Modality | null {
  const value = root.getAttribute(MODALITY_ATTRIBUTE);
  return value === "keyboard" || value === "pointer" ? value : null;
}

const CAPTURE = { capture: true };

// Listens on the window in the capture phase, so the press or key is read
// before any handler that stops it and before the focus it causes. The window
// blur listener is not capture on purpose: an element's blur does not bubble,
// so only the window itself losing focus reaches it. Returns the teardown.
export function trackModality(
  root: AttributeHost = document.documentElement,
  target: ListenerHost = window,
): () => void {
  const apply = (event: Event) => {
    const current = readModality(root);
    const next = nextModality(current, { type: event.type, key: (event as KeyboardEvent).key });
    if (next === current) return;
    if (next) root.setAttribute(MODALITY_ATTRIBUTE, next);
    else root.removeAttribute(MODALITY_ATTRIBUTE);
  };
  target.addEventListener("pointerdown", apply, CAPTURE);
  target.addEventListener("keydown", apply, CAPTURE);
  target.addEventListener("blur", apply);
  return () => {
    target.removeEventListener("pointerdown", apply, CAPTURE);
    target.removeEventListener("keydown", apply, CAPTURE);
    target.removeEventListener("blur", apply);
  };
}

// Keyboard focus, for the code that mirrors the ring: the browser says the
// element is focus-visible and the last input was not a press.
export function isKeyboardFocus(element: Element): boolean {
  return element.matches(":focus-visible") && readModality(element.ownerDocument.documentElement) !== "pointer";
}
