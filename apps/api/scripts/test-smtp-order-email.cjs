/**
 * Send a test order confirmation via the same SMTP path as production.
 * Usage: node apps/api/scripts/test-smtp-order-email.cjs [toEmail]
 */
const { loadApiEnv } = require('./load-env.cjs');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');

loadApiEnv();

function normalizeSmtpSecure(port, secure) {
  if (port === 465) return true;
  if (port === 587 || port === 25 || port === 2525) return false;
  return secure;
}

async function main() {
  const to = process.argv[2] || 'sohelitonline@gmail.com';
  await mongoose.connect(process.env.MONGODB_URI);
  const doc = await mongoose.connection.db.collection('email_settings').findOne({ key: 'global' });
  if (!doc) {
    console.error('No email_settings');
    process.exit(1);
  }

  const passDoc = await mongoose.connection.db
    .collection('email_settings')
    .findOne({ key: 'global' }, { projection: { smtpPass: 1 } });

  const port = doc.smtpPort > 0 ? doc.smtpPort : 587;
  const secure = normalizeSmtpSecure(port, Boolean(doc.smtpSecure));
  const smtp = {
    host: doc.smtpHost?.trim(),
    port,
    secure,
    user: doc.smtpUser?.trim(),
    pass: passDoc?.smtpPass?.trim(),
  };

  console.log('SMTP test to:', to);
  console.log('Host:', smtp.host, 'port:', port, 'secure:', secure, 'user:', smtp.user);

  if (!smtp.host) {
    console.error('No SMTP host');
    process.exit(1);
  }
  if (smtp.user && !smtp.pass) {
    console.error('SMTP user set but password missing in DB');
    process.exit(1);
  }

  const transport = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    requireTLS: !smtp.secure && smtp.port === 587,
    auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
  });

  try {
    await transport.verify();
    console.log('SMTP verify: OK');
  } catch (e) {
    console.error('SMTP verify FAILED:', e.message);
    process.exit(1);
  }

  const info = await transport.sendMail({
    from: { name: 'UniQbd Test', address: doc.ordersFromEmail || doc.fromEmail || smtp.user },
    to,
    subject: `[UniQbd SMTP test] ${new Date().toISOString()}`,
    text: 'If you receive this, SMTP from MongoDB email_settings works.',
    html: '<p>If you receive this, SMTP from MongoDB <strong>email_settings</strong> works.</p>',
  });

  console.log('Sent:', info.messageId);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
