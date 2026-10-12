/**
 * Mark processing orders as delivered when every line already has codes.
 *
 * Usage:
 *   NODE_PATH=apps/api/node_modules node deploy/deploy/ubuntu22.04/tools/reconcile-stuck-orders.cjs
 */
const path = require('path');
require(path.join(__dirname, '../../../../apps/api/scripts/load-env.cjs')).loadApiEnv();
const mongoose = require('mongoose');

const URI = process.env.MONGODB_URI;
if (!URI) {
  console.error('FAIL: MONGODB_URI is not set');
  process.exit(1);
}

function isAutoCompletableLine(item) {
  if (item.deliveryType === 'auto') return true;
  if (Array.isArray(item.inventoryItemIds) && item.inventoryItemIds.length > 0) {
    return true;
  }
  if (item.deliverySource === 'supplier') return true;
  return false;
}

function canAutoComplete(order) {
  if (!Array.isArray(order.items) || order.items.length === 0) return false;
  if (!order.items.every((item) => item.delivered)) return false;
  return order.items.every((item) => isAutoCompletableLine(item));
}

(async () => {
  const conn = await mongoose.createConnection(URI).asPromise();
  const orders = conn.collection('orders');
  const cursor = orders.find({ status: 'processing' });
  let fixed = 0;

  for await (const order of cursor) {
    if (!canAutoComplete(order)) continue;
    const now = new Date();
    await orders.updateOne(
      { _id: order._id },
      {
        $set: {
          status: 'delivered',
          deliveredAt: order.deliveredAt ?? now,
        },
        $push: {
          timeline: {
            status: 'delivered',
            at: now,
            note: 'Auto-delivery complete (reconciled)',
          },
        },
      },
    );
    fixed += 1;
    console.log(`  fixed ${order.orderNumber ?? order._id}`);
  }

  console.log(`\nDone. ${fixed} order(s) moved to delivered.`);
  await conn.close();
})().catch((error) => {
  console.error('FAIL:', error?.message ?? error);
  process.exit(1);
});
