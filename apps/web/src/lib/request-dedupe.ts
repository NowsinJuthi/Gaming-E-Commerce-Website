const inFlight = new Map<string, Promise<unknown>>();

export function dedupeKey(
  method: string,
  url: string,
  authenticated = false,
): string {
  const token =
    authenticated && typeof window !== "undefined"
      ? (localStorage.getItem("accessToken") ?? "")
      : "";
  return `${method.toUpperCase()}:${url}:${token}`;
}

export function dedupeRequest<T>(
  key: string,
  factory: () => Promise<T>,
): Promise<T> {
  const existing = inFlight.get(key);
  if (existing) return existing as Promise<T>;

  const promise = factory().finally(() => {
    inFlight.delete(key);
  });
  inFlight.set(key, promise);
  return promise;
}
