require('./load-env.cjs').loadApiEnv();
const mongoose = require('mongoose');

const URI = process.env.MONGODB_URI;
if (!URI) {
  console.error('MONGODB_URI is not set');
  process.exit(1);
}

const DARK_LOGO = '/logo/uniqbd-logo-dark.png';

(async () => {
  await mongoose.connect(URI);
  const col = mongoose.connection.collection('customer_panel_settings');

  const result = await col.updateOne(
    { key: 'global' },
    {
      $set: {
        'appearance.logoUrlDark': DARK_LOGO,
        'appearance.logoUrlAdmin': DARK_LOGO,
        'appearance.logoUrlFooterDark': DARK_LOGO,
        'appearance.logoAlt': 'UniQbd',
        'appearance.siteName': 'UniQbd',
      },
    },
  );

  console.log('Dark logo updated:', result.modifiedCount || result.matchedCount);
  await mongoose.disconnect();
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
