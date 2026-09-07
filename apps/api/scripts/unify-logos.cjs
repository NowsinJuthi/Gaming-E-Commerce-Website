require('./load-env.cjs').loadApiEnv();
const mongoose = require('mongoose');

const URI = process.env.MONGODB_URI;
if (!URI) {
  console.error('MONGODB_URI is not set');
  process.exit(1);
}

(async () => {
  await mongoose.connect(URI);
  const result = await mongoose.connection
    .collection('customer_panel_settings')
    .updateOne(
      { key: 'global' },
      {
        $set: {
          'appearance.logoUrlAdmin': '',
          'appearance.logoUrlFooter': '',
          'appearance.logoUrlFooterLight': '',
          'appearance.logoUrlFooterDark': '',
        },
      },
    );
  console.log('Unified logo placements:', result.modifiedCount || result.matchedCount);
  await mongoose.disconnect();
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
