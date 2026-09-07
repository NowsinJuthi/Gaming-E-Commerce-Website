/**
 * Send order confirmation email for an existing order (uses DB SMTP + templates).
 * Usage: node apps/api/scripts/send-order-confirmation-now.cjs <orderNumber>
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
  const orderNumber = process.argv[2];
  if (!orderNumber) {
    console.error('Usage: node send-order-confirmation-now.cjs <orderNumber>');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const order = await db.collection('orders').findOne({ orderNumber: String(orderNumber) });
  if (!order?.contact?.email) {
    console.error('Order or contact email not found');
    process.exit(1);
  }

  const settings = await db.collection('email_settings').findOne({ key: 'global' });
  const passDoc = await db
    .collection('email_settings')
    .findOne({ key: 'global' }, { projection: { smtpPass: 1 } });

  const port = settings.smtpPort > 0 ? settings.smtpPort : 587;
  const secure = normalizeSmtpSecure(port, Boolean(settings.smtpSecure));
  const transport = nodemailer.createTransport({
    host: settings.smtpHost,
    port,
    secure,
    auth: {
      user: settings.smtpUser,
      pass: passDoc?.smtpPass,
    },
  });

  const to = order.contact.email.trim();
  const items = (order.items ?? [])
    .map((i) => `- ${i.title} x${i.quantity}`)
    .join('\n');
  const total = order.pricing?.total ?? 0;
  const currency = order.pricing?.currency ?? 'BDT';

  const info = await transport.sendMail({
    from: {
      name: settings.ordersFromName || settings.fromName || 'UniQbd',
      address: settings.ordersFromEmail || settings.fromEmail || settings.smtpUser,
    },
    to,
    subject: `Order #${orderNumber} confirmed`,
    text: `Thank you for your order #${orderNumber}.\n\n${items}\n\nTotal: ${currency} ${total}\n\nWe are preparing your delivery.`,
    html: `<p>Thank you for your order <strong>#${orderNumber}</strong>.</p><pre>${items}</pre><p>Total: <strong>${currency} ${total}</strong></p><p>We are preparing your delivery.</p>`,
  });

  await db.collection('orders').updateOne(
    { _id: order._id },
    { $set: { 'customerEmails.confirmationSentAt': new Date() } },
  );

  console.log('Sent to', to, 'messageId:', info.messageId);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
