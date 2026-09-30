import type { Page } from "@playwright/test";

// Which script chunks a page loaded, and whether one of them is the scene's
// (three and CoilScene, split into their own dynamic chunk). A chunk is the
// scene's when its source carries three's renderer; the reduced-motion,
// holding and no-WebGL paths must never fetch it.

const SCENE_MARKER = /WebGLRenderer/;

export function watchScripts(page: Page) {
  const bodies: Promise<{ url: string; scene: boolean }>[] = [];
  page.on("response", (response) => {
    const url = response.url();
    if (!/\.js(\?|$)/.test(url) || response.status() >= 400) return;
    bodies.push(
      response
        .text()
        .then((text) => ({ url, scene: SCENE_MARKER.test(text) }))
        .catch(() => ({ url, scene: false })),
    );
  });
  return {
    async sceneChunks() {
      const all = await Promise.all(bodies);
      return all.filter((script) => script.scene).map((script) => script.url);
    },
    async count() {
      return (await Promise.all(bodies)).length;
    },
  };
}
