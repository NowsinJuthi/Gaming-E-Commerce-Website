/** Normalize legacy VPS upload URLs in customer_panel_settings appearance logos. */
const { loadApiEnv } = require('./load-env.cjs');
const mongoose = require('mongoose');

loadApiEnv();

const BAD = [
  /^https?:\/\/103\.114\.38\.220(?::\d+)?/i,
  /^https?:\/\/127\.0\.0\.1(?::\d+)?/i,
  /^https?:\/\/localhost(?::\d+)?/i,
];

function fixUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return value;
  const trimmed = value.trim().replace(/\/api\/api\//i, '/api/');
  if (trimmed.startsWith('/api/uploads/')) return trimmed;
  try {
    const parsed = new URL(trimmed);
    if (!parsed.pathname.startsWith('/api/uploads/')) return value;
    if (!BAD.some((re) => re.test(parsed.origin))) return value;
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return value;
  }
}

mongoose
  .connect(process.env.MONGODB_URI)
  .then(async () => {
    const col = mongoose.connection.collection('customer_panel_settings');
    const doc = await col.findOne({});
    if (!doc?.appearance) {
      console.log('No appearance settings found.');
      return;
    }
    const keys = [
      'logoUrlLight',
      'logoUrlDark',
      'logoUrlAdmin',
      'logoUrlFooter',
      'logoUrlFooterLight',
      'logoUrlFooterDark',
      'adminFaviconUrl',
    ];
    const updates = {};
    for (const key of keys) {
      const next = fixUrl(doc.appearance[key]);
      if (next !== doc.appearance[key]) {
        updates[`appearance.${key}`] = next;
        console.log(`${key}:`, doc.appearance[key], '->', next);
      }
    }
    if (Object.keys(updates).length) {
      await col.updateOne({ _id: doc._id }, { $set: updates });
      console.log('Updated customer_panel_settings appearance logos.');
    } else {
      console.log('Logo URLs already normalized.');
    }
  })
  .finally(() => mongoose.disconnect());
