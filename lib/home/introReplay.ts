// The lab's replay buttons reach the page through these two window events (dev
// only: nothing in production dispatches them). The loader and the deal each
// listen for their own.
export const LOADER_REPLAY_EVENT = "intro-loader:replay";

export function replayLoader(): void {
  window.dispatchEvent(new Event(LOADER_REPLAY_EVENT));
}
