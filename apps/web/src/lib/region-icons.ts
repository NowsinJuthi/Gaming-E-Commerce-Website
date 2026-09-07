const GLOBAL_REGIONS = new Set([
  "GLOBAL",
  "WORLD",
  "WORLDWIDE",
  "EMEA",
  "ASIA",
  "MENA",
]);

const REGION_CODE_ALIASES: Record<string, string> = {
  UK: "GB",
  USA: "US",
};

const REGION_NAME_CODES: Record<string, string> = {
  "UNITED STATES": "US",
  "UNITED STATES OF AMERICA": "US",
  USA: "US",
  BANGLADESH: "BD",
  INDIA: "IN",
  "UNITED KINGDOM": "GB",
  "GREAT BRITAIN": "GB",
  ENGLAND: "GB",
  CANADA: "CA",
  AUSTRALIA: "AU",
  GERMANY: "DE",
  FRANCE: "FR",
  JAPAN: "JP",
  "SOUTH KOREA": "KR",
  KOREA: "KR",
  SINGAPORE: "SG",
  MALAYSIA: "MY",
  INDONESIA: "ID",
  PHILIPPINES: "PH",
  PAKISTAN: "PK",
  UAE: "AE",
  "UNITED ARAB EMIRATES": "AE",
  "SAUDI ARABIA": "SA",
  TURKEY: "TR",
  BRAZIL: "BR",
  MEXICO: "MX",
  ITALY: "IT",
  SPAIN: "ES",
  NETHERLANDS: "NL",
  POLAND: "PL",
  SWEDEN: "SE",
  NORWAY: "NO",
  DENMARK: "DK",
  FINLAND: "FI",
  IRELAND: "IE",
  PORTUGAL: "PT",
  GREECE: "GR",
  THAILAND: "TH",
  VIETNAM: "VN",
  "HONG KONG": "HK",
  TAIWAN: "TW",
  CHINA: "CN",
  RUSSIA: "RU",
  UKRAINE: "UA",
  "SOUTH AFRICA": "ZA",
  EGYPT: "EG",
  NIGERIA: "NG",
  ARGENTINA: "AR",
  CHILE: "CL",
  COLOMBIA: "CO",
  PERU: "PE",
  "NEW ZEALAND": "NZ",
  QATAR: "QA",
  KUWAIT: "KW",
  OMAN: "OM",
  BAHRAIN: "BH",
  JORDAN: "JO",
  LEBANON: "LB",
  ISRAEL: "IL",
  SWITZERLAND: "CH",
  AUSTRIA: "AT",
  BELGIUM: "BE",
  "CZECH REPUBLIC": "CZ",
  ROMANIA: "RO",
  HUNGARY: "HU",
};

function countryCodeToFlagEmoji(code: string): string | null {
  if (!/^[A-Z]{2}$/.test(code)) return null;
  const points = [...code].map((char) => 0x1f1e6 + (char.charCodeAt(0) - 65));
  return String.fromCodePoint(...points);
}

function normalizeRegionName(value: string): string {
  return value.trim().toUpperCase();
}

function resolveCodeAlias(code: string): string {
  return REGION_CODE_ALIASES[code] ?? code;
}

export function isGlobalRegion(region: string): boolean {
  return GLOBAL_REGIONS.has(normalizeRegionName(region));
}

export function resolveRegionCountryCode(region: string): string | null {
  const normalized = normalizeRegionName(region);
  if (!normalized || isGlobalRegion(normalized)) return null;
  if (normalized === "EU") return "EU";

  const parenCode = normalized.match(/\(([A-Z]{2,3})\)/)?.[1];
  if (parenCode) {
    const code = resolveCodeAlias(parenCode);
    if (/^[A-Z]{2}$/.test(code)) return code;
  }

  if (/^[A-Z]{2}$/.test(normalized)) {
    return resolveCodeAlias(normalized);
  }

  const hyphenCode = normalized.match(/-([A-Z]{2})$/)?.[1];
  if (hyphenCode) {
    return resolveCodeAlias(hyphenCode);
  }

  const suffixCode = normalized.match(/\b([A-Z]{2})$/)?.[1];
  if (suffixCode) {
    return resolveCodeAlias(suffixCode);
  }

  const nameOnly = normalized.replace(/\s*\([A-Z]{2,3}\)\s*$/, "").trim();
  if (REGION_NAME_CODES[nameOnly]) return REGION_NAME_CODES[nameOnly];
  if (REGION_NAME_CODES[normalized]) return REGION_NAME_CODES[normalized];

  return null;
}

export function getRegionFlagUrl(
  region: string,
  size: 20 | 40 = 40,
): string | null {
  const code = resolveRegionCountryCode(region);
  if (!code) return null;
  return `https://flagcdn.com/w${size}/${code.toLowerCase()}.png`;
}

export function getRegionIcon(region: string): string {
  const normalized = normalizeRegionName(region);
  if (!normalized) return "🌐";
  if (isGlobalRegion(normalized)) return "🌐";
  if (normalized === "EU") return "🇪🇺";
  if (normalized === "ASIA") return "🌏";
  if (normalized === "EMEA" || normalized === "MENA") return "🌍";

  const countryCode = resolveRegionCountryCode(region);
  if (countryCode) {
    return countryCodeToFlagEmoji(countryCode) ?? "🌐";
  }

  return "🌐";
}

export function formatRegionWithIcon(region: string): string {
  return `${getRegionIcon(region)} ${region}`;
}
