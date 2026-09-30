import { test as base, expect, type CDPSession } from "@playwright/test";

// The suite's test object. Every page is held to the local server: a request
// to any other host is aborted and recorded, and a test that tried to reach
// Vercel or the production domain fails. `cdp` is a DevTools session on the
// test's page, for input Playwright's own API cannot express. (Each fixture's
// second argument is named provide, not use: the React hooks lint rule reads
// a call to use() as a hook.)

const LOCAL = /^(https?|wss?):\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?\//;
const FORBIDDEN = /vercel|aaronsulbaran\.com/i;

type Fixtures = {
  offsite: string[];
  cdp: CDPSession;
};

export const test = base.extend<Fixtures>({
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
