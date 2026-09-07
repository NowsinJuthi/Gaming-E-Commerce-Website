/* Apply UniQbd brand logo + dark palette to customer panel settings. */
require('./load-env.cjs').loadApiEnv();
const mongoose = require('mongoose');

const URI = process.env.MONGODB_URI;
if (!URI) {
  console.error('UPDATE APPEARANCE ERROR: MONGODB_URI is not set (check apps/api/.env)');
  process.exit(1);
}

const APPEARANCE = {
  defaultTheme: 'dark',
  accent: 'emerald',
  brandColor: '#26BFB0',
  dark: { bg: '#050c12', elevated: '#07101a', muted: '#091420' },
  logoUrlDark: '/logo/uniqbd-logo-dark.png',
  logoUrlAdmin: '/logo/uniqbd-logo-dark.png',
  logoUrlFooterDark: '/logo/uniqbd-logo-dark.png',
  logoAlt: 'UniQbd',
  siteName: 'UniQbd',
};

(async () => {
  await mongoose.connect(URI);
  const col = mongoose.connection.collection('customer_panel_settings');
  const result = await col.updateOne(
    { key: 'global' },
    {
      $set: {
        'appearance.defaultTheme': APPEARANCE.defaultTheme,
        'appearance.accent': APPEARANCE.accent,
        'appearance.brandColor': APPEARANCE.brandColor,
        'appearance.dark': APPEARANCE.dark,
        'appearance.logoUrlDark': APPEARANCE.logoUrlDark,
        'appearance.logoUrlAdmin': APPEARANCE.logoUrlAdmin,
        'appearance.logoUrlFooterDark': APPEARANCE.logoUrlFooterDark,
        'appearance.logoAlt': APPEARANCE.logoAlt,
        'appearance.siteName': APPEARANCE.siteName,
      },
    },
    { upsert: true },
  );
  console.log('Appearance updated:', result.modifiedCount || result.upsertedCount || 'ok');
  await mongoose.disconnect();
})().catch((err) => {
  console.error('UPDATE APPEARANCE ERROR:', err.message);
  process.exit(1);
});
