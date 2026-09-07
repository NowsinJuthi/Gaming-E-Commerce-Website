/* Seed demo categories + products (idempotent upserts) for the storefront. */
require('./load-env.cjs').loadApiEnv();
const mongoose = require('mongoose');

const URI =
  process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/uniqbd';

const oid = (hex) => new mongoose.Types.ObjectId(hex);

// Fixed ObjectIds so re-running stays idempotent.
const CATS = [
  { _id: oid('64a000000000000000000001'), name: 'Gaming Top-Up', slug: 'gaming' },
  { _id: oid('64a000000000000000000002'), name: 'Software Licenses', slug: 'software' },
  { _id: oid('64a000000000000000000003'), name: 'Gift Cards', slug: 'gift-cards' },
  { _id: oid('64a000000000000000000004'), name: 'Subscriptions', slug: 'subscriptions' },
];

const img = (seed) => `https://picsum.photos/seed/${seed}/640/420`;

const P = [
  ['PUBG Mobile 660 UC', 'pubg-mobile-660-uc', '64a000000000000000000001', 'topup', 9.99, 12.99, 'Instant 660 Unknown Cash top-up for PUBG Mobile. Delivered to your account automatically.'],
  ['Free Fire 1060 Diamonds', 'free-fire-1060-diamonds', '64a000000000000000000001', 'topup', 10.49, 13.0, 'Recharge 1060 diamonds instantly to your Free Fire ID.'],
  ['Windows 11 Pro Key', 'windows-11-pro-key', '64a000000000000000000002', 'license', 24.99, 39.99, 'Genuine lifetime Windows 11 Pro activation key. Instant email delivery.'],
  ['Microsoft Office 2021', 'microsoft-office-2021', '64a000000000000000000002', 'license', 34.99, 59.99, 'Office 2021 Professional Plus lifetime license for 1 PC.'],
  ['Amazon Gift Card $25', 'amazon-gift-card-25', '64a000000000000000000003', 'giftcard', 25.0, 25.0, 'Redeemable Amazon.com gift card worth $25. Code sent instantly.'],
  ['Google Play $10', 'google-play-10', '64a000000000000000000003', 'giftcard', 10.0, 10.0, 'Google Play store credit worth $10. Works worldwide.'],
  ['Netflix Premium 1 Month', 'netflix-premium-1-month', '64a000000000000000000004', 'subscription', 8.99, 15.49, '1 month Netflix Premium 4K UHD subscription.'],
  ['Spotify Premium 3 Months', 'spotify-premium-3-months', '64a000000000000000000004', 'subscription', 14.99, 29.99, '3 months of ad-free Spotify Premium.'],
];

(async () => {
  const conn = await mongoose.createConnection(URI).asPromise();
  const now = new Date();

  const cats = conn.collection('categories');
  for (let i = 0; i < CATS.length; i += 1) {
    const c = CATS[i];
    await cats.updateOne(
      { slug: c.slug },
      {
        $set: {
          name: c.name,
          slug: c.slug,
          parentId: null,
          ancestors: [],
          isActive: true,
          order: i,
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );
  }

  const products = conn.collection('products');
  for (const [title, slug, catId, type, basePrice, compareAt, description] of P) {
    await products.updateOne(
      { slug },
      {
        $set: {
          title,
          titleNormalized: title.toLowerCase(),
          slug,
          description,
          categoryId: oid(catId),
          categoryPath: [oid(catId)],
          type,
          deliveryType: 'auto',
          pricing: { currency: 'BDT', cost: 0, basePrice, compareAt },
          stock: { available: 999, reserved: 0, sold: 0 },
          media: [{ url: img(slug), type: 'image', alt: title }],
          availableRegions: ['GLOBAL'],
          status: 'active',
          ratings: { avg: 4 + Math.random(), count: 10 + Math.floor(Math.random() * 200) },
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );
  }

  const pc = await products.countDocuments({ status: 'active' });
  console.log(`SEED OK: ${CATS.length} categories, ${pc} active products`);
  await conn.close();
})().catch((e) => {
  console.error('SEED ERROR', e.message);
  process.exit(1);
});
