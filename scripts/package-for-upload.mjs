/**
 * Package a clean native Ubuntu release (no node_modules, builds, env, or uploads).
 *
 * Usage (from repo root):
 *   node scripts/package-for-upload.mjs
 */
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import { platform } from "os";

const ROOT = process.cwd();

const INCLUDE_TOP = [
  "apps",
  "deploy",
  "packages",
  "scripts",
  ".npmrc",
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "turbo.json",
];

const EXCLUDE = [
  "node_modules",
  ".next",
  "dist",
  ".turbo",
  ".git",
  "coverage",
  ".env",
  ".env.production.local",
  ".env.local",
  "*.production.env",
  "*.local.env",
  "uniqbd-upload.zip",
  "uniqbd-upload.tar.gz",
  "uniqbd.com.tar.gz",
];

if (!existsSync(join(ROOT, "package.json"))) {
  console.error("Run from monorepo root");
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
if (pkg.name !== "uniqbd") {
  console.error(`Expected package name uniqbd, got ${pkg.name}`);
  process.exit(1);
}

const items = INCLUDE_TOP.filter((p) => existsSync(join(ROOT, p)));

console.log("Packaging native Ubuntu release");
console.log("Include:", items.join(", "));
console.log("Exclude:", EXCLUDE.join(", "));

if (platform() === "win32") {
  console.log("\nZip these into uniqbd-upload.zip (WinRAR / 7-Zip):");
  for (const p of items) console.log(`  ${p}`);
  console.log("\nDo NOT include: node_modules, .next, dist, .turbo, .env");
  console.log("\nServer steps:");
  console.log("  1. Extract into /opt/uniqbd/incoming (never an aaPanel webroot)");
  console.log("  2. sudo bash deploy/deploy/ubuntu22.04/migrate-from-aapanel.sh /opt/uniqbd/incoming");
  console.log("  3. sudo VERIFY_PUBLIC=1 /opt/uniqbd.com/deploy/deploy/ubuntu22.04/verify.sh");
  process.exit(0);
}

const OUT_TAR = join(ROOT, "uniqbd-upload.tar.gz");
const excludeArgs = EXCLUDE.map((e) => `--exclude='${e}'`).join(" ");
execSync(
  `tar -czf "${OUT_TAR}" ${excludeArgs} ${items.join(" ")}`,
  { cwd: ROOT, stdio: "inherit", shell: "/bin/bash" },
);
console.log(`\nCreated: ${OUT_TAR}`);
console.log("Extract into /opt/uniqbd/incoming then:");
console.log("  sudo bash deploy/deploy/ubuntu22.04/migrate-from-aapanel.sh /opt/uniqbd/incoming");
