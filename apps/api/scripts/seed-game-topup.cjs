/* Seed 8 demo Game Top-Up products (idempotent upserts). */
require('./load-env.cjs').loadApiEnv();
const mongoose = require('mongoose');

const URI = process.env.MONGODB_URI;
if (!URI) {
  console.error('SEED GAME TOPUP ERROR: MONGODB_URI is not set (check apps/api/.env)');
  process.exit(1);
}

const CATEGORY_SLUGS = ['game-topup', 'gaming', 'game-top-up', 'topup'];

const DEMO_PRODUCTS = [
  ['PUBG Mobile 60 UC', 'demo-pubg-mobile-60-uc', 99, 129, 'Instant 60 Unknown Cash for PUBG Mobile.'],
  ['PUBG Mobile 325 UC', 'demo-pubg-mobile-325-uc', 499, 599, 'Instant 325 Unknown Cash for PUBG Mobile.'],
  ['Free Fire 100 Diamonds', 'demo-free-fire-100-diamonds', 89, 110, '100 diamonds delivered to your Free Fire ID.'],
  ['Free Fire 520 Diamonds', 'demo-free-fire-520-diamonds', 399, 479, '520 diamonds top-up for Free Fire.'],
  ['Mobile Legends 86 Diamonds', 'demo-mobile-legends-86-diamonds', 149, 179, '86 diamonds for Mobile Legends: Bang Bang.'],
  ['Genshin Impact 60 Genesis Crystals', 'demo-genshin-60-genesis-crystals', 129, 159, '60 Genesis Crystals for Genshin Impact.'],
  ['Call of Duty Mobile 80 CP', 'demo-cod-mobile-80-cp', 99, 119, '80 COD Points for Call of Duty Mobile.'],
  ['Valorant 475 VP', 'demo-valorant-475-vp', 449, 549, '475 Valorant Points for your Riot account region.'],
];

const img = (seed) => `https://picsum.photos/seed/${seed}/640/420`;

(async () => {
  const conn = await mongoose.createConnection(URI).asPromise();
  const now = new Date();
  const cats = conn.collection('categories');
  const products = conn.collection('products');

  let category = null;
  for (const slug of CATEGORY_SLUGS) {
    category = await cats.findOne({ slug, isActive: { $ne: false } });
    if (category) break;
  }

  if (!category) {
    category = await cats.findOne({
      name: /game.*top[\s-]?up/i,
      isActive: { $ne: false },
    });
  }

  if (!category) {
    const inserted = await cats.insertOne({
      name: 'Game TopUp',
      slug: 'game-topup',
      parentId: null,
      path: [],
      depth: 0,
      isActive: true,
      order: 0,
      createdAt: now,
      updatedAt: now,
    });
    category = await cats.findOne({ _id: inserted.insertedId });
    console.log('Created category: Game TopUp');
  }

  const categoryId = category._id;
  const categoryPath = Array.isArray(category.path) && category.path.length
    ? [...category.path, categoryId]
    : [categoryId];

  for (const [title, slug, basePrice, compareAt, description] of DEMO_PRODUCTS) {
    await products.updateOne(
      { slug },
      {
        $set: {
          title,
          titleNormalized: title.toLowerCase(),
          slug,
          description,
          categoryId,
          categoryPath,
          type: 'topup',
          deliveryType: 'auto',
          pricing: { currency: 'BDT', cost: 0, basePrice, compareAt },
          stock: { available: 999, reserved: 0, sold: 0 },
          media: [{ url: img(slug), type: 'image', alt: title }],
          availableRegions: ['GLOBAL'],
          status: 'active',
          ratings: { avg: 4.5, count: 24 },
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );
  }

  const count = await products.countDocuments({
    categoryId,
    type: 'topup',
    status: 'active',
  });

  console.log(
    `SEED GAME TOPUP OK: category="${category.name}" (${category.slug}), ${count} active top-up products`,
  );
  await conn.close();
})().catch((err) => {
  console.error('SEED GAME TOPUP ERROR:', err.message);
  process.exit(1);
});
