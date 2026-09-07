const { loadApiEnv } = require('./load-env.cjs');
const mongoose = require('mongoose');

loadApiEnv();

function normalizeSmtpSecure(port, secure) {
  if (port === 465) return true;
  if (port === 587 || port === 25 || port === 2525) return false;
  return secure;
}

mongoose
  .connect(process.env.MONGODB_URI)
  .then(async () => {
    const col = mongoose.connection.collection('email_settings');
    const doc = await col.findOne({ key: 'global' });
    if (!doc) {
      console.log('No email_settings document found.');
      return;
    }
    const port = doc.smtpPort > 0 ? doc.smtpPort : 587;
    const nextSecure = normalizeSmtpSecure(port, Boolean(doc.smtpSecure));
    if (nextSecure === doc.smtpSecure) {
      console.log('Already correct:', { port, secure: nextSecure, host: doc.smtpHost });
      return;
    }
    await col.updateOne({ key: 'global' }, { $set: { smtpSecure: nextSecure } });
    console.log('Updated:', {
      host: doc.smtpHost,
      port,
      smtpSecure: `${doc.smtpSecure} -> ${nextSecure}`,
    });
  })
  .finally(() => mongoose.disconnect());
