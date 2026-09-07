/**
 * Resend guest order confirmation email (idempotent — skips if already sent).
 * Usage: node apps/api/scripts/resend-order-confirmation.cjs [orderNumber]
 */
const { loadApiEnv } = require('./load-env.cjs');
const mongoose = require('mongoose');

loadApiEnv();

async function main() {
  const orderNumber = process.argv[2];
  if (!orderNumber) {
    console.error('Usage: node resend-order-confirmation.cjs <orderNumber>');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const order = await db.collection('orders').findOne({ orderNumber: String(orderNumber) });
  if (!order) {
    console.error('Order not found:', orderNumber);
    process.exit(1);
  }

  const user = order.userId
    ? await db.collection('users').findOne({ _id: order.userId })
    : null;

  console.log('Order:', orderNumber, 'status:', order.status);
  console.log('Contact:', order.contact?.email);
  console.log('Guest user:', user?.isGuest ?? false);
  console.log('confirmationSentAt:', order.customerEmails?.confirmationSentAt ?? '(never)');

  const unset = process.argv.includes('--force');
  if (unset) {
    await db.collection('orders').updateOne(
      { _id: order._id },
      { $unset: { 'customerEmails.confirmationSentAt': '' } },
    );
    console.log('Cleared confirmationSentAt — will resend on next API trigger');
  } else {
    console.log('\nTo force resend, redeploy API and run with --force, then place a test or call resend via updated API.');
    console.log('Or clear flag manually and restart order flow.');
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
