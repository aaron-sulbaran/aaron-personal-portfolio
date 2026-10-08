// The two ways a visitor's browser lacks WebGL 2, as init scripts: no API at
// all, or an API whose contexts never start (Chrome with graphics acceleration off).
export function noWebgl2Api() {
  Reflect.deleteProperty(window, "WebGL2RenderingContext");
}
export function noWebglContext() {
  const original = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string, ...rest: unknown[]) {
    if (/webgl/i.test(kind)) return null;
    return (original as (...args: unknown[]) => unknown).call(this, kind, ...rest);
  } as typeof original;
}
