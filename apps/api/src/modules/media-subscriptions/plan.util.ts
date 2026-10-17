export function normalizeFeatureBullets(bullets?: string[] | null): string[] {
  if (!bullets?.length) return [];
  return bullets
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, 30);
}
