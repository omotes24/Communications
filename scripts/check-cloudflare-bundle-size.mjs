import { spawnSync } from "node:child_process";
import path from "node:path";

const freeLimitKiB = 3 * 1024;
const warningLimitKiB = 2.7 * 1024;
const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";

const result = spawnSync(
  npxCommand,
  [
    "--no-install",
    "wrangler",
    "deploy",
    "--dry-run",
    "--outdir",
    ".wrangler/size-check",
  ],
  {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      NO_COLOR: "1",
      WRANGLER_LOG_PATH: path.join(process.cwd(), ".wrangler", "logs"),
    },
  },
);

if (result.error) {
  throw result.error;
}

const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;

if (result.status !== 0) {
  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");
  process.exit(result.status ?? 1);
}

const gzipMatch = output.match(/gzip:\s*([\d.]+)\s*KiB/i);
if (!gzipMatch) {
  process.stderr.write(output);
  throw new Error("Could not read the gzip bundle size from Wrangler output.");
}

const gzipKiB = Number(gzipMatch[1]);
if (!Number.isFinite(gzipKiB)) {
  throw new Error("Wrangler returned an invalid gzip bundle size.");
}

const summary = `Cloudflare Worker gzip: ${gzipKiB.toFixed(2)} KiB / ${freeLimitKiB} KiB`;

if (gzipKiB > freeLimitKiB) {
  throw new Error(`${summary} — Workers Free limit exceeded.`);
}

if (gzipKiB > warningLimitKiB) {
  console.warn(`${summary} — approaching the Workers Free limit.`);
} else {
  console.log(`${summary} — within the Workers Free limit.`);
}
