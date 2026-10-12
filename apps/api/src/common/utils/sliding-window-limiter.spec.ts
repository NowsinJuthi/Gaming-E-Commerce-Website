import { SlidingWindowLimiter } from './sliding-window-limiter';

describe('SlidingWindowLimiter', () => {
  it('allows up to the max hits then rejects', () => {
    const limiter = new SlidingWindowLimiter(2, 60_000);
    expect(limiter.allow('u1')).toBe(true);
    expect(limiter.allow('u1')).toBe(true);
    expect(limiter.allow('u1')).toBe(false);
    expect(limiter.allow('u2')).toBe(true);
  });
});
