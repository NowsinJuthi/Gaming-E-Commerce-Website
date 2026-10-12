/** In-process sliding window for Next.js route abuse control. */
export class SlidingWindowLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  allow(key: string): boolean {
    const now = Date.now();
    const start = now - this.windowMs;
    const previous = this.hits.get(key) ?? [];
    const recent = previous.filter((stamp) => stamp > start);
    if (recent.length >= this.max) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }
}
