import { test as base, expect, type CDPSession } from "@playwright/test";
import { INVITE_KEY } from "@/lib/quick/invite";

// The suite's test object. Every page is held to the local server: a request
// to any other host is aborted and recorded, and a test that tried to reach
// Vercel or the production domain fails. `cdp` is a DevTools session on the
// test's page, for input Playwright's own API cannot express. (Each fixture's
// second argument is named provide, not use: the React hooks lint rule reads
// a call to use() as a hook.)
//
// `inviteDismissed` (default true) starts every context with the Express lane's
// first-visit invite already answered. Its toast sits at the bottom right of
// the home, 1.5s after the hero is ready, and would land over the canvas
// between screenshots and break the pixel comparisons; express-lane.spec turns
// it off with test.use to test the invite itself.

const LOCAL = /^(https?|wss?):\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?\//;
const FORBIDDEN = /vercel|aaronsulbaran\.com/i;

type Fixtures = {
  offsite: string[];
  cdp: CDPSession;
  inviteDismissed: boolean;
};

export const test = base.extend<Fixtures>({
  inviteDismissed: [true, { option: true }],
  context: async ({ context, inviteDismissed }, provide) => {
    if (inviteDismissed) await context.addInitScript((key) => localStorage.setItem(key, "dismissed"), INVITE_KEY);
    await provide(context);
  },
  offsite: [
    async ({ context }, provide) => {
      const blocked: string[] = [];
      await context.route(
        (url) => !LOCAL.test(url.href) && url.protocol !== "data:" && url.protocol !== "blob:",
        (route) => {
          blocked.push(route.request().url());
          return route.abort("blockedbyclient");
        },
      );
      await provide(blocked);
      expect(blocked.filter((url) => FORBIDDEN.test(url)), "requests to Vercel or the production domain").toEqual([]);
    },
    { auto: true },
  ],
  cdp: async ({ page }, provide) => {
    const session = await page.context().newCDPSession(page);
    await provide(session);
    await session.detach().catch(() => undefined);
  },
});

export { expect };
