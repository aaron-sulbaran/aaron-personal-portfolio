// The one dynamic entry to the Coil chunk (three and everything that draws
// with it). CoilStage and the name canvas both import this module, so the
// bundler makes one chunk group for it and three is fetched once; two entries
// into the same modules would each get their own copy of three.
export { default as CoilScene } from "./CoilScene";
export { startNameCanvas } from "./nameCanvas/start";
