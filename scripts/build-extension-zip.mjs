import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const sourceDir = path.join(root, "extension");
const outDir = path.join(root, "public", "downloads");
const outFile = path.join(outDir, "solvesnap-extension.zip");

if (!existsSync(sourceDir)) {
  console.error(`extension/ not found at ${sourceDir}`);
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
if (existsSync(outFile)) {
  rmSync(outFile);
}

execFileSync("zip", ["-r", outFile, ".", "-x", ".DS_Store"], {
  cwd: sourceDir,
  stdio: "inherit",
});

console.log(`Wrote ${path.relative(root, outFile)}`);
