/**
 * Diagnose why customer order emails may not send.
 * Usage: node scripts/diagnose-email.cjs [API_BASE]
 */
require('../apps/api/scripts/load-env.cjs').loadApiEnv();

const mongoose = require('mongoose');
const API = (process.argv[2] || process.env.API_PUBLIC_URL || 'http://127.0.0.1:4000/api').replace(/\/$/, '');

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI missing');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const emailSettings = await db.collection('email_settings').findOne({ key: 'global' });
  const templates = await db.collection('email_templates').find({}).toArray();
  const processing = templates.find((t) => t.id === 'order.processing');
  const completed = templates.find((t) => t.id === 'order.completed');

  const recentGuestOrders = await db
    .collection('orders')
    .find({ 'contact.email': { $exists: true, $ne: '' } })
    .sort({ createdAt: -1 })
    .limit(5)
    .project({ orderNumber: 1, status: 1, 'contact.email': 1, createdAt: 1, userId: 1 })
    .toArray();

  const envHost = process.env.SMTP_HOST?.trim() || '';
  const envPass = process.env.SMTP_PASS?.trim() ? '(set)' : '(empty)';

  console.log('\n=== Email diagnosis ===\n');
  console.log('API:', API);
  console.log('Env SMTP_HOST:', envHost || '(empty)');
  console.log('Env SMTP_PASS:', envPass);
  console.log('Env SMTP_USER:', process.env.SMTP_USER || '(empty)');

  if (!emailSettings) {
    console.log('\nDB email_settings: NOT FOUND (will use env only)');
  } else {
    const dbHost = emailSettings.smtpHost?.trim() || '';
    const dbPassDoc = await db
      .collection('email_settings')
      .findOne({ key: 'global' }, { projection: { smtpPass: 1, ordersSmtpPass: 1 } });
    console.log('\nDB email_settings:');
    console.log('  enabled:', emailSettings.enabled);
    console.log('  mockMode:', emailSettings.mockMode);
    console.log('  smtpHost:', dbHost || '(empty — falls back to env)');
    console.log('  smtpPort:', emailSettings.smtpPort || '(default 587)');
    console.log('  smtpSecure:', emailSettings.smtpSecure);
    console.log('  smtpUser:', emailSettings.smtpUser || '(empty)');
    console.log('  smtpPass:', dbPassDoc?.smtpPass?.trim() ? '(set)' : '(empty)');
    console.log('  ordersSmtpUser:', emailSettings.ordersSmtpUser || '(empty)');
    console.log('  ordersSmtpPass:', dbPassDoc?.ordersSmtpPass?.trim() ? '(set)' : '(empty)');
    console.log('  ordersFromEmail:', emailSettings.ordersFromEmail || emailSettings.fromEmail || '(empty)');

    const effectiveHost = dbHost || envHost;
    console.log('\nEffective SMTP host:', effectiveHost || '*** NOT CONFIGURED — emails are skipped ***');
    if (!effectiveHost) {
      console.log('\nFIX: Set SMTP host + password in Admin → Settings → Email, OR set SMTP_HOST/SMTP_PASS in .env');
    }
    if (emailSettings.mockMode) {
      console.log('\nWARNING: mockMode=true — emails are logged but NOT sent');
    }
    if (emailSettings.enabled === false) {
      console.log('\nWARNING: enabled=false — all emails skipped');
    }
  }

  console.log('\nTemplates:');
  console.log('  order.processing:', processing ? (processing.enabled ? 'enabled' : 'DISABLED') : 'missing (uses default)');
  console.log('  order.completed:', completed ? (completed.enabled ? 'enabled' : 'DISABLED') : 'missing (uses default)');

  console.log('\nRecent orders with contact email:');
  for (const o of recentGuestOrders) {
    const user = o.userId
      ? await db.collection('users').findOne({ _id: o.userId }, { projection: { isGuest: 1, email: 1 } })
      : null;
    console.log(
      `  #${o.orderNumber} status=${o.status} guest=${user?.isGuest ?? '?'} contact=${o.contact?.email} at=${o.createdAt}`,
    );
  }

  try {
    const res = await fetch(`${API}/health`, { signal: AbortSignal.timeout(8000) });
    console.log('\nAPI health:', res.status, res.ok ? 'OK' : 'FAIL');
  } catch (e) {
    console.log('\nAPI health: unreachable —', e.message);
  }

  console.log('');
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
