/**
 * Write deploy-manifest.json after a successful build (used by redeploy.sh).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const buildIdPath = path.join(ROOT, 'apps/web/.next/BUILD_ID');
const apiMainPath = path.join(ROOT, 'apps/api/dist/main.js');

if (!fs.existsSync(buildIdPath)) {
  console.error('FAIL: apps/web/.next/BUILD_ID missing — Next.js build did not complete');
  process.exit(1);
}

if (!fs.existsSync(apiMainPath)) {
  console.error('FAIL: apps/api/dist/main.js missing — API build did not complete');
  process.exit(1);
}

const buildId = fs.readFileSync(buildIdPath, 'utf8').trim();
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

const manifest = {
  deployedAt: new Date().toISOString(),
  root: ROOT,
  buildId,
  packageName: pkg.name,
  packageVersion: pkg.version,
  node: process.version,
};

const outPath = path.join(ROOT, 'deploy-manifest.json');
fs.writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`deploy-manifest.json → buildId=${buildId}`);
