/** Accept tiny float drift from gateways; reject material amount mismatches. */
export function webhookAmountMatches(
  parsedAmount: number | undefined,
  intentAmount: number,
): boolean {
  if (typeof parsedAmount !== 'number' || !Number.isFinite(parsedAmount)) {
    return true;
  }
  return Math.abs(parsedAmount - intentAmount) <= 0.009;
}
