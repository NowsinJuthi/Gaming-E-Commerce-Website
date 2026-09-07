/**
 * Import Clash Of Clans Gems reviews from legacy WordPress SQL dump.
 * Usage: node scripts/import-coc-reviews.cjs [path-to-uniqbd_com.sql]
 */
require('../apps/api/scripts/load-env.cjs').loadApiEnv();
const fs = require('node:fs');
const mongoose = require('mongoose');

const SQL_PATH =
  process.argv[2] ||
  process.env.WP_SQL_DUMP ||
  'C:/Users/sohel/OneDrive/Desktop/uniqbd_com.sql';

const WP_POST_ID = '29582';

const REVIEWS = [
  {
    legacyWpId: '392',
    customerName: 'Jayed Hasan',
    customerEmail: 'nnowsinjuthi@gmail.com',
    rating: 5,
    body: 'Best price for COC Gems in Bangladesh. Safe payment and quick delivery. Highly recommended.',
    createdAt: new Date('2025-06-11T15:24:39.000Z'),
    adminReply:
      'আপনার মূল্যবান মতামতের জন্য, আপনাকে অসংখ্য ধন্যবাদ।😍',
    adminReplyAuthor: 'UniQbd',
    adminReplyAt: new Date('2025-06-11T15:25:47.000Z'),
  },
  {
    legacyWpId: '393',
    customerName: 'Farhan',
    customerEmail: 'nnowsinjuthi@gmail.com',
    rating: 5,
    body: 'Excellent service! My COC Gems arrived instantly without any problem. Trusted website.',
    createdAt: new Date('2025-03-25T15:25:08.000Z'),
    adminReply:
      'আপনার মূল্যবান মতামতের জন্য, আপনাকে অসংখ্য ধন্যবাদ।😍',
    adminReplyAuthor: 'UniQbd',
    adminReplyAt: new Date('2025-03-25T15:25:55.000Z'),
  },
];

async function findProduct(db) {
  const products = db.collection('products');
  const byTitle = await products.findOne({
    title: { $regex: /clash\s*of\s*clans\s*gems/i },
  });
  if (byTitle) return byTitle;

  const bySlug = await products.findOne({
    slug: { $regex: /clash-of-clans|clash_of_clans|coc-gems/i },
  });
  if (bySlug) return bySlug;

  const loose = await products
    .find({ title: { $regex: /clash.*clans/i } })
    .project({ title: 1, slug: 1 })
    .limit(5)
    .toArray();
  if (loose.length === 1) return loose[0];
  if (loose.length > 1) {
    const exact = loose.find((p) => /gems/i.test(p.title));
    if (exact) return exact;
    throw new Error(
      `Multiple Clash products found: ${loose.map((p) => p.title).join(', ')}`,
    );
  }

  return null;
}

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not set');
    process.exit(1);
  }
  if (!fs.existsSync(SQL_PATH)) {
    console.warn(`SQL dump not found at ${SQL_PATH} — using embedded review data`);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const product = await findProduct(db);
  if (!product) {
    console.error('Clash Of Clans Gems product not found in MongoDB');
    process.exit(1);
  }

  const reviews = db.collection('product_reviews');
  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of REVIEWS) {
    const doc = {
      productId: product._id,
      productTitle: product.title,
      productSlug: product.slug,
      customerName: row.customerName,
      customerEmail: row.customerEmail,
      rating: row.rating,
      body: row.body,
      status: 'published',
      adminReply: row.adminReply,
      adminReplyAuthor: row.adminReplyAuthor,
      adminReplyAt: row.adminReplyAt,
      legacyWpId: row.legacyWpId,
      createdAt: row.createdAt,
      updatedAt: row.createdAt,
    };

    const existing = await reviews.findOne({ legacyWpId: row.legacyWpId });
    if (existing) {
      const needsUpdate =
        String(existing.productId) !== String(product._id) ||
        existing.body !== doc.body ||
        existing.adminReply !== doc.adminReply;
      if (needsUpdate) {
        await reviews.updateOne(
          { _id: existing._id },
          {
            $set: {
              productId: doc.productId,
              productTitle: doc.productTitle,
              productSlug: doc.productSlug,
              customerName: doc.customerName,
              customerEmail: doc.customerEmail,
              rating: doc.rating,
              body: doc.body,
              status: doc.status,
              adminReply: doc.adminReply,
              adminReplyAuthor: doc.adminReplyAuthor,
              adminReplyAt: doc.adminReplyAt,
              updatedAt: new Date(),
            },
          },
        );
        updated += 1;
      } else {
        skipped += 1;
      }
      continue;
    }

    await reviews.insertOne(doc);
    inserted += 1;
  }

  const totalForProduct = await reviews.countDocuments({
    productId: product._id,
    status: 'published',
  });

  console.log(
    JSON.stringify(
      {
        product: { id: String(product._id), title: product.title, slug: product.slug },
        wpPostId: WP_POST_ID,
        inserted,
        updated,
        skipped,
        publishedReviewsOnProduct: totalForProduct,
      },
      null,
      2,
    ),
  );

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
