/**
 * Reclaim historical Failed intents that were superseded before the
 * `superseded` status existed. Late gateway captures can then enter unmatched
 * reconciliation instead of being dropped.
 *
 * Dry-run (default):
 *   node apps/api/scripts/recover-superseded-payments.cjs
 *
 * Write:
 *   node apps/api/scripts/recover-superseded-payments.cjs --apply
 *
 * Never prints gateway references or payment amounts.
 */
require('./load-env.cjs').loadApiEnv();
const mongoose = require('mongoose');

const APPLY = process.argv.includes('--apply');
const URI = process.env.MONGODB_URI;
const MESSAGE = 'Superseded by a new checkout';

if (!URI) {
  console.error('MONGODB_URI is not set');
  process.exit(1);
}

(async () => {
  const conn = await mongoose.createConnection(URI).asPromise();
  const col = conn.db.collection('payment_intents');
  const filter = {
    status: 'failed',
    lastError: MESSAGE,
    $or: [
      { gatewayRef: { $exists: true, $nin: [null, ''] } },
      { chargeLeaseUntil: { $exists: true, $ne: null } },
    ],
  };
  const reclaim = await col.countDocuments(filter);
  const skip = await col.countDocuments({
    status: 'failed',
    lastError: MESSAGE,
  });
  if (APPLY && reclaim > 0) {
    await col.updateMany(filter, {
      $set: { status: 'superseded' },
      $unset: { expiresAt: 1, activeOrderSlot: 1, chargeLeaseUntil: 1 },
    });
  }
  console.log(
    APPLY
      ? `Applied superseded recovery. reclaim=${reclaim} scannedFailedSuperseded=${skip}`
      : `Dry-run. Would reclaim=${reclaim} of failed-superseded=${skip}. Re-run with --apply to write.`,
  );
  await conn.close();
})().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
