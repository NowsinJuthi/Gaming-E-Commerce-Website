import { Injectable } from '@nestjs/common';

/**
 * Process-local gate for the one-active-intent unique index.
 * Production startup/readiness must not report ready until this is marked.
 */
@Injectable()
export class PaymentInvariantService {
  private ready = false;
  private reason = 'Payment active-order index has not been verified';

  isReady(): boolean {
    return this.ready;
  }

  blockReason(): string {
    return this.reason;
  }

  markReady(): void {
    this.ready = true;
    this.reason = '';
  }

  markBlocked(reason: string): void {
    this.ready = false;
    this.reason = reason;
  }
}
