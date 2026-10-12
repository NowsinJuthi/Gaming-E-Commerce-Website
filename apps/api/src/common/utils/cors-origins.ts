export function parseCorsOrigins(raw: string | string[] | undefined): Set<string> {
  const origins = new Set<string>();
  const entries = Array.isArray(raw)
    ? raw
    : String(raw ?? 'http://localhost:3000').split(',');
  for (const entry of entries) {
    const value = entry.trim();
    if (!value) continue;
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('API_CORS_ORIGIN contains an unsupported protocol');
    }
    origins.add(parsed.origin);
  }
  if (origins.size === 0) {
    throw new Error('API_CORS_ORIGIN must contain at least one valid origin');
  }
  return origins;
}

export function isAllowedCorsOrigin(
  origin: string | undefined,
  allowed: Set<string>,
): boolean {
  if (!origin) return true;
  if (origin === 'null') return false;
  try {
    return allowed.has(new URL(origin).origin);
  } catch {
    return false;
  }
}

export function socketIoCorsOptions(raw = process.env.API_CORS_ORIGIN): {
  origin: (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void,
  ) => void;
  credentials: true;
  methods: string[];
} {
  return {
    origin: (origin, callback) => {
      const allowed = parseCorsOrigins(raw ?? 'http://localhost:3000');
      callback(null, isAllowedCorsOrigin(origin, allowed));
    },
    credentials: true,
    methods: ['GET', 'POST'],
  };
}
