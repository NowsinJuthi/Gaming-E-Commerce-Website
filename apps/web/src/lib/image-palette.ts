export type ImagePalette = {
  primary: string;
  secondary: string;
  accent: string;
};

/** Stable dark fallback — avoids brand-color flash before extraction. */
export const DEFAULT_IMAGE_PALETTE: ImagePalette = {
  primary: "6 9 16",
  secondary: "4 6 12",
  accent: "8 11 18",
};

const paletteCache = new Map<string, ImagePalette>();

export function getCachedImagePalette(src: string): ImagePalette | null {
  return paletteCache.get(src) ?? null;
}

export function cacheImagePalette(src: string, palette: ImagePalette): void {
  paletteCache.set(src, palette);
}

const PALETTE_DARKEN = 0.46;

function rgbString(r: number, g: number, b: number): string {
  return `${Math.round(r)} ${Math.round(g)} ${Math.round(b)}`;
}

function darkenRgb(r: number, g: number, b: number): string {
  return rgbString(r * PALETTE_DARKEN, g * PALETTE_DARKEN, b * PALETTE_DARKEN);
}

function pixelSaturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === 0) return 0;
  return (max - min) / max;
}

function pixelBrightness(r: number, g: number, b: number): number {
  return (r * 0.299 + g * 0.587 + b * 0.114) / 255;
}

function quantize(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/**
 * Samples a product image and returns space-separated RGB tuples for CSS vars.
 */
export async function extractImagePalette(
  src: string,
): Promise<ImagePalette | null> {
  if (!src || typeof window === "undefined") return null;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const size = 56;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          resolve(null);
          return;
        }

        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);

        const buckets = new Map<
          string,
          { r: number; g: number; b: number; weight: number }
        >();

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i] ?? 0;
          const g = data[i + 1] ?? 0;
          const b = data[i + 2] ?? 0;
          const a = data[i + 3] ?? 0;
          if (a < 128) continue;

          const brightness = pixelBrightness(r, g, b);
          if (brightness < 0.08 || brightness > 0.94) continue;

          const saturation = pixelSaturation(r, g, b);
          const weight = 0.35 + saturation * 1.65;
          const key = `${quantize(r, 28)}-${quantize(g, 28)}-${quantize(b, 28)}`;
          const bucket = buckets.get(key);

          if (bucket) {
            const total = bucket.weight + weight;
            bucket.r = (bucket.r * bucket.weight + r * weight) / total;
            bucket.g = (bucket.g * bucket.weight + g * weight) / total;
            bucket.b = (bucket.b * bucket.weight + b * weight) / total;
            bucket.weight = total;
          } else {
            buckets.set(key, { r, g, b, weight });
          }
        }

        const ranked = [...buckets.values()].sort((a, b) => b.weight - a.weight);
        if (!ranked.length) {
          resolve(null);
          return;
        }

        const primary = ranked[0]!;
        const secondary =
          ranked.find((c) => colorDistance(primary, c) > 48) ?? ranked[1] ?? primary;
        const accent =
          ranked.find(
            (c) =>
              c !== primary &&
              c !== secondary &&
              colorDistance(primary, c) > 32,
          ) ?? secondary;

        const palette: ImagePalette = {
          primary: darkenRgb(primary.r, primary.g, primary.b),
          secondary: darkenRgb(secondary.r, secondary.g, secondary.b),
          accent: darkenRgb(accent.r, accent.g, accent.b),
        };
        cacheImagePalette(src, palette);
        resolve(palette);
      } catch {
        resolve(null);
      }
    };

    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function colorDistance(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number },
): number {
  return Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
}
