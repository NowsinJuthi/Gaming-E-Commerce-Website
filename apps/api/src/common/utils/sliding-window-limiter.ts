/** In-process sliding window used for WebSocket event spam control. */
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
    if (this.hits.size > 10_000) {
      this.prune(start);
    }
    return true;
  }

  private prune(start: number): void {
    for (const [key, stamps] of this.hits) {
      const recent = stamps.filter((stamp) => stamp > start);
      if (recent.length === 0) this.hits.delete(key);
      else this.hits.set(key, recent);
    }
  }
}
