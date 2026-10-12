export type PublicHealthBody = { status: 'ok' | 'unavailable' };

export function publicLivenessBody(): PublicHealthBody {
  return { status: 'ok' };
}

export function publicReadinessOkBody(): PublicHealthBody {
  return { status: 'ok' };
}

export function publicReadinessUnavailableBody(): PublicHealthBody {
  return { status: 'unavailable' };
}

/** Production traffic is not ready until the unique active-order index is live. */
export function publicReadinessRequiresPayments(input: {
  production: boolean;
  paymentsReady: boolean;
}): boolean {
  return !input.production || input.paymentsReady;
}
