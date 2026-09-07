/**
 * Package only apps/api for server upload when full monorepo upload missed API.
 *
 * Usage: node scripts/package-api-for-upload.mjs
 */
import { existsSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import { platform } from "os";

const ROOT = process.cwd();
const API = join(ROOT, "apps", "api");

if (!existsSync(join(API, "package.json"))) {
  console.error("apps/api/package.json not found — run from monorepo root");
  process.exit(1);
}

const EXCLUDE = ["node_modules", "dist", ".turbo"];

console.log("Package apps/api only (no node_modules, no dist)");
console.log("Exclude:", EXCLUDE.join(", "));

if (platform() === "win32") {
  const out = join(ROOT, "api-only.zip");
  console.log("\nOn Windows, run in PowerShell from repo root:");
  console.log(`
$temp = Join-Path $env:TEMP "uniqbd-api-only"
Remove-Item $temp -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path "$temp\\api" -Force | Out-Null
robocopy apps\\api "$temp\\api" /E /XD node_modules dist .turbo /NFL /NDL /NJH /NJS
Compress-Archive -Path "$temp\\api" -DestinationPath api-only.zip -Force
Remove-Item $temp -Recurse -Force
`);
  console.log("Created path: api-only.zip");
  console.log("\nServer (after upload to /www/wwwroot/uniqbd.com):");
  console.log("  cd /www/wwwroot/uniqbd.com");
  console.log("  unzip -o api-only.zip -d apps");
  console.log("  ls apps/api/package.json");
  process.exit(0);
}

const out = join(ROOT, "api-only.tar.gz");
const excludeArgs = EXCLUDE.map((e) => `--exclude='${e}'`).join(" ");
execSync(
  `tar -czf "${out}" ${excludeArgs} -C apps api`,
  { cwd: ROOT, stdio: "inherit", shell: "/bin/bash" },
);
console.log(`Created: ${out}`);
console.log("Server: unzip or tar -xzf ... -C apps");
