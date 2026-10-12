import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PaymentIntentStatus } from '../../common/enums';
import {
  HISTORICAL_SUPERSEDED_ERROR,
  isHistoricalSupersededFailure,
  planHistoricalSupersededRecovery,
  supersededRecoveryLogLine,
} from './payment-superseded-recovery';

describe('historical superseded payment recovery', () => {
  it('reclaims Failed leftovers that still have a gateway reference', () => {
    const plan = planHistoricalSupersededRecovery([
      {
        id: 'old-capture',
        status: PaymentIntentStatus.Failed,
        lastError: HISTORICAL_SUPERSEDED_ERROR,
        gatewayRef: 'pay_1',
      },
      {
        id: 'never-charged',
        status: PaymentIntentStatus.Failed,
        lastError: HISTORICAL_SUPERSEDED_ERROR,
      },
      {
        id: 'real-failure',
        status: PaymentIntentStatus.Failed,
        lastError: 'Gateway reported failure (webhook)',
        gatewayRef: 'pay_2',
      },
    ]);
    expect(plan.reclaimIds).toEqual(['old-capture']);
    expect(plan.skipIds).toEqual(['never-charged', 'real-failure']);
    expect(supersededRecoveryLogLine(plan)).toBe(
      'superseded recovery reclaim=1 skip=2',
    );
  });

  it('does not treat a current superseded intent as a failed leftover', () => {
    expect(
      isHistoricalSupersededFailure({
        id: 'live',
        status: PaymentIntentStatus.Superseded,
        lastError: HISTORICAL_SUPERSEDED_ERROR,
        gatewayRef: 'pay_9',
      }),
    ).toBe(false);
  });

  it('operator recovery script is dry-run by default and never prints gateway refs', () => {
    const src = readFileSync(
      join(__dirname, '../../../scripts/recover-superseded-payments.cjs'),
      'utf8',
    );
    expect(src).toContain("process.argv.includes('--apply')");
    expect(src).toContain('Superseded by a new checkout');
    expect(src).not.toMatch(/console\.log\([^)]*gatewayRef/);
    expect(src).not.toMatch(/console\.log\([^)]*row\./);
  });
});
