import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { defineConfig, devices, type Project } from "@playwright/test";
import { MUTED_ARGS } from "./e2e/support/launch";

// The end to end suite (e2e/). It runs against local production builds only,
// never the dev server, a Vercel preview or the production domain: the full
// site on 3140 and the holding page on 3141 (a separate build, see
// e2e/support/holding-server.mjs, since both modes cannot share one .next).
//
// Chromium runs through the "chromium" channel (the full browser in its new
// headless mode): it gets the machine's GPU, so the scene renders at the
// display rate as it does for a visitor. The bundled headless shell falls back
// to SwiftShader at about 30fps, which is not the frame budget the coil is
// tuned for. WebKit and Firefox are configured but only run with E2E_ALL=1
// and their browsers installed.
//
// Every browser is muted (e2e/support/launch.ts): Chromium by flag, Firefox by
// pref. WebKit has no mute switch, so it skips the specs that start playback.

const CI = !!process.env.CI;
const FULL_PORT = 3140;
const HOLDING_PORT = 3141;
// E2E_BASE_URL points the suite at another local build of the full site
// (an older commit, to prove a test fails where the defect lived); the suite
// then starts no servers of its own.
const OTHER_BUILD = process.env.E2E_BASE_URL;
if (OTHER_BUILD && !/^http:\/\/localhost:\d+\/?$/.test(OTHER_BUILD)) throw new Error("E2E_BASE_URL must be a localhost URL");
const FULL_URL = OTHER_BUILD ?? `http://localhost:${FULL_PORT}`;
const HOLDING_URL = `http://localhost:${HOLDING_PORT}`;

// The desktop visitor the capture rules are written for: a fine, hovering
// pointer on a 1440 by 900 pane at 1x.
const desktop = {
  ...devices["Desktop Chrome"],
  channel: "chromium",
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  baseURL: FULL_URL,
  launchOptions: { args: MUTED_ARGS },
};

function installed(prefix: string) {
  const caches = process.env.PLAYWRIGHT_BROWSERS_PATH
    ? [process.env.PLAYWRIGHT_BROWSERS_PATH]
    : [join(homedir(), "Library", "Caches", "ms-playwright"), join(homedir(), ".cache", "ms-playwright")];
  return caches.some((cache) => existsSync(cache) && readdirSync(cache).some((name) => name.startsWith(prefix)));
}

const otherEngines: Project[] =
  process.env.E2E_ALL === "1"
    ? [
        ...(installed("webkit-")
          ? [{ name: "webkit", testIgnore: /(holding|touch|soundtrack|horizon)\.spec\.ts/, use: { ...devices["Desktop Safari"], baseURL: FULL_URL } }]
          : []),
        ...(installed("firefox-")
          ? [{ name: "firefox", testIgnore: /(holding|touch)\.spec\.ts/, use: { ...devices["Desktop Firefox"], baseURL: FULL_URL, launchOptions: { firefoxUserPrefs: { "media.volume_scale": "0.0" } } } }]
          : []),
      ]
    : [];

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results",
  // The scene is GPU bound and several tests read frame timing, so one test
  // runs at a time.
  fullyParallel: false,
  workers: 1,
  retries: CI ? 1 : 0,
  forbidOnly: CI,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", testIgnore: /(holding|touch)\.spec\.ts/, use: desktop },
    {
      name: "touch",
      testMatch: /touch\.spec\.ts/,
      use: {
        ...devices["Pixel 7"],
        channel: "chromium",
        baseURL: FULL_URL,
        launchOptions: { args: MUTED_ARGS },
      },
    },
    { name: "holding", testMatch: /holding\.spec\.ts/, use: { ...desktop, baseURL: HOLDING_URL } },
    ...otherEngines,
  ],
  webServer: OTHER_BUILD ? [] : [
    {
      // E2E_NO_BUILD=1 starts the last build as it is (a rerun with no source change).
      command: process.env.E2E_NO_BUILD === "1" ? `pnpm start -p ${FULL_PORT}` : `pnpm build && pnpm start -p ${FULL_PORT}`,
      url: FULL_URL,
      env: { NEXT_PUBLIC_SITE_MODE: "full" },
      reuseExistingServer: !CI,
      timeout: 240_000,
      stdout: "ignore",
      stderr: "pipe",
    },
    {
      command: `node e2e/support/holding-server.mjs ${HOLDING_PORT}`,
      url: HOLDING_URL,
      reuseExistingServer: !CI,
      timeout: 300_000,
      stdout: "ignore",
      stderr: "pipe",
    },
  ],
});
