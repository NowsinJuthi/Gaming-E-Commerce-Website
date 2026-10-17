export function normalizeFeatureBullets(bullets?: string[] | null): string[] {
  if (!bullets?.length) return [];
  return bullets
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, 30);
}

export function normalizeFeaturesHeading(heading?: string | null): string {
  const trimmed = heading?.trim();
  if (!trimmed) return 'All features';
  return trimmed.slice(0, 80);
}
