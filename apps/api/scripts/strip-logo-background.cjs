/**
 * OPTIONAL manual tool — do NOT run on admin uploads.
 * Only use when you intentionally need to remove a solid black canvas
 * from a static file in public/logo.
 *
 * Usage: node scripts/strip-logo-background.cjs path/to/logo.png
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const BACKGROUND_THRESHOLD = 42;
const FRINGE_THRESHOLD = 52;

function isNearBlack(r, g, b, threshold) {
  return r <= threshold && g <= threshold && b <= threshold;
}

function cornerAlphas(data, width, height, channels) {
  const corners = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
  ];
  return corners.map(([x, y]) => data[(y * width + x) * channels + 3]);
}

function alreadyTransparent(data, width, height, channels) {
  return cornerAlphas(data, width, height, channels).every((alpha) => alpha < 16);
}

function stripEdgeBlackBackground(data, width, height, channels) {
  const visited = new Uint8Array(width * height);
  const queue = [];

  for (let x = 0; x < width; x += 1) {
    queue.push([x, 0], [x, height - 1]);
  }
  for (let y = 0; y < height; y += 1) {
    queue.push([0, y], [width - 1, y]);
  }

  while (queue.length) {
    const [x, y] = queue.pop();
    if (x < 0 || y < 0 || x >= width || y >= height) continue;

    const idx = y * width + x;
    if (visited[idx]) continue;
    visited[idx] = 1;

    const i = idx * channels;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (!isNearBlack(r, g, b, BACKGROUND_THRESHOLD)) continue;

    data[i + 3] = 0;
    queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
}

function defringeNearBlack(data, width, height, channels) {
  const alphaAt = (x, y) => data[(y * width + x) * channels + 3];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * channels;
      const alpha = data[i + 3];
      if (alpha === 0) continue;

      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (!isNearBlack(r, g, b, FRINGE_THRESHOLD)) continue;

      const touchesTransparent =
        (x > 0 && alphaAt(x - 1, y) === 0) ||
        (x < width - 1 && alphaAt(x + 1, y) === 0) ||
        (y > 0 && alphaAt(x, y - 1) === 0) ||
        (y < height - 1 && alphaAt(x, y + 1) === 0);

      if (touchesTransparent) data[i + 3] = 0;
    }
  }
}

async function stripBlackBackground(file) {
  const abs = path.resolve(file);
  if (!fs.existsSync(abs)) {
    throw new Error(`Missing logo file: ${abs}`);
  }

  const { data, info } = await sharp(abs)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;

  if (alreadyTransparent(data, width, height, channels)) {
    console.log(`Skipped (already transparent): ${path.basename(abs)}`);
    return;
  }

  stripEdgeBlackBackground(data, width, height, channels);
  defringeNearBlack(data, width, height, channels);

  const tmp = `${abs}.tmp`;
  await sharp(data, { raw: { width, height, channels } })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(tmp);
  fs.renameSync(tmp, abs);

  console.log(`Stripped black canvas: ${path.basename(abs)} (${width}x${height})`);
}

const files = process.argv.slice(2);
if (!files.length) {
  console.error('Pass at least one logo path. This script is manual-only.');
  process.exit(1);
}

(async () => {
  for (const file of files) {
    await stripBlackBackground(file);
  }
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
