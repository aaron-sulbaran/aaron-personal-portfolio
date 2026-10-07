// Whether this browser can make a real WebGL 2 context right now. The API
// can exist while no context can be made (a blocklisted GPU, a policy, the
// context limit), so CoilStage asks this before it fetches three and the
// scene; without a context the chunk is never requested and the hero still
// carries the page.
// The probe's context is released at once.
export function canCreateWebGL2() {
  try {
    const context = document.createElement("canvas").getContext("webgl2");
    if (!context) return false;
    context.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}
