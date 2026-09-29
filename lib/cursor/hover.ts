// The custom cursor's hover signal from the Coil canvas. DOM targets opt in
// with [data-cursor-hover] and the cursor finds them with closest(); a card in
// the canvas has no element, and it moves under a still pointer (the coil
// spins), so the scene publishes "a card is under the pointer" here every time
// it changes and CustomCursor subscribes. The canvas never sets a CSS cursor.

let hovering = false;
const listeners = new Set<() => void>();

export function getSceneHover(): boolean {
  return hovering;
}

export function setSceneHover(next: boolean) {
  if (hovering === next) return;
  hovering = next;
  listeners.forEach((listener) => listener());
}

export function subscribeSceneHover(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
