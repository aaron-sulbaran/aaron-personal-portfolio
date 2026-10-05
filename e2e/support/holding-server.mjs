// The holding page's own production server for the e2e holding project.
//
// NEXT_PUBLIC_SITE_MODE is inlined at build time, so the holding page needs
// its own build, and two builds cannot share this checkout's .next (the full
// site's server reads it while the suite runs). This copies the working tree
// (sources only) to a directory outside the repo, installs from the pnpm
// store there, builds it in holding mode and serves it on the given port.
// Usage: node e2e/support/holding-server.mjs <port>
import { spawn, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const port = process.argv[2] ?? "3141";
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const target = join(tmpdir(), "aaronsulbaran-e2e-holding");
const SKIP = new Set([".git", ".next", "node_modules", "test-results", "playwright-report", "e2e", ".vercel"]);
const stamp = join(target, "node_modules", ".e2e-lock");

function attempt(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: ["ignore", "ignore", "inherit"],
    env: { ...process.env, NEXT_PUBLIC_SITE_MODE: "holding" },
  });
  return result.status ?? 1;
}

function run(command, args, cwd) {
  const status = attempt(command, args, cwd);
  if (status !== 0) process.exit(status);
}

const install = () => {
  run("pnpm", ["install", "--frozen-lockfile", "--prefer-offline", "--ignore-scripts", "--reporter=silent"], target);
  cpSync(join(root, "pnpm-lock.yaml"), stamp);
};

// A fresh copy of the sources on every start; node_modules survives between
// runs and is reinstalled only when the lockfile changed. The OS prunes its
// temp dir, which can leave a partly deleted node_modules behind a matching
// stamp, so a failed build reinstalls from scratch and tries once more.
mkdirSync(target, { recursive: true });
for (const entry of [".next", "app", "components", "lib", "public"]) rmSync(join(target, entry), { recursive: true, force: true });
cpSync(root, target, {
  recursive: true,
  filter: (source) => {
    const path = relative(root, source);
    return path === "" || !SKIP.has(path.split(sep)[0]);
  },
});
const lock = readFileSync(join(root, "pnpm-lock.yaml"), "utf8");
if (!existsSync(stamp) || readFileSync(stamp, "utf8") !== lock) install();
if (attempt("pnpm", ["exec", "next", "build"], target) !== 0) {
  console.error("[holding-server] build failed; reinstalling node_modules and building once more");
  for (const entry of ["node_modules", ".next"]) rmSync(join(target, entry), { recursive: true, force: true });
  install();
  run("pnpm", ["exec", "next", "build"], target);
}

const server = spawn("pnpm", ["exec", "next", "start", "-p", port], {
  cwd: target,
  stdio: ["ignore", "ignore", "inherit"],
  env: { ...process.env, NEXT_PUBLIC_SITE_MODE: "holding" },
});
const stop = () => server.kill("SIGTERM");
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
server.on("exit", (code) => process.exit(code ?? 0));
