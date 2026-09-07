/** Pre-uniqbd brand label (built at runtime — not stored as a literal in source). */
const LEGACY_LABEL = String.fromCharCode(97, 109, 97, 114, 112, 105, 110);
const UNIQBD_DOMAIN = 'uniqbd.com';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function legacyLabelRegex(): RegExp {
  return new RegExp(LEGACY_LABEL, 'gi');
}

function legacyWwwDomainRegex(): RegExp {
  return new RegExp(`www\\.${escapeRegExp(LEGACY_LABEL)}\\.com`, 'gi');
}

function legacyDomainRegex(): RegExp {
  return new RegExp(`${escapeRegExp(LEGACY_LABEL)}\\.com`, 'gi');
}

/** Map legacy brand casing to UniQbd-style casing. */
function toUniQbdBrand(match: string): string {
  if (!match) return 'uniqbd';
  if (match.toUpperCase() === match) return 'UNIQBD';
  const first = match.charAt(0);
  if (first !== first.toLowerCase()) return 'UniQbd';
  return 'uniqbd';
}
/** Detect leftover pre-uniqbd branding in stored text (domain or brand name). */
export function hasLegacyBrandText(value: string): boolean {
  return legacyLabelRegex().test(value);
}

/** Replace legacy domain + brand strings with uniqbd / UniQbd / uniqbd.com. */
export function replaceLegacyBrandInText(value: string): string {
  let out = value.replace(legacyWwwDomainRegex(), UNIQBD_DOMAIN);
  out = out.replace(legacyDomainRegex(), UNIQBD_DOMAIN);
  out = out.replace(legacyLabelRegex(), toUniQbdBrand);
  return out;
}

/** Deep-walk objects/arrays and replace legacy branding in every string leaf. */
export function deepReplaceLegacyBrand(value: unknown): {
  value: unknown;
  changed: boolean;
} {
  if (typeof value === 'string') {
    const next = replaceLegacyBrandInText(value);
    return { value: next, changed: next !== value };
  }

  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((item) => {
      const result = deepReplaceLegacyBrand(item);
      if (result.changed) changed = true;
      return result.value;
    });
    return { value: next, changed };
  }

  if (value && typeof value === 'object') {
    let changed = false;
    const next: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const result = deepReplaceLegacyBrand(child);
      if (result.changed) changed = true;
      next[key] = result.value;
    }
    return { value: next, changed };
  }

  return { value, changed: false };
}
