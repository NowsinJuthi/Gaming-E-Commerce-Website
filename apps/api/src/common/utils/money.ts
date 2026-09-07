/** Rounds a monetary amount to 2 decimal places, avoiding float drift. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
