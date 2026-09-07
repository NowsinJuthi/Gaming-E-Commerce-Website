require('./load-env.cjs').loadApiEnv();
const mongoose = require('mongoose');

const URI = process.env.MONGODB_URI;
if (!URI) {
  console.error('MONGODB_URI is not set');
  process.exit(1);
}

const LIGHT_LOGO = '/logo/uniqbd-logo-light.png';

(async () => {
  await mongoose.connect(URI);
  const col = mongoose.connection.collection('customer_panel_settings');

  const result = await col.updateOne(
    { key: 'global' },
    {
      $set: {
        'appearance.logoUrlLight': LIGHT_LOGO,
        'appearance.logoUrlFooterLight': LIGHT_LOGO,
      },
    },
  );

  console.log('Light logo updated:', result.modifiedCount || result.matchedCount);
  await mongoose.disconnect();
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
