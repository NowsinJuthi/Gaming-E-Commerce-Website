/* Idempotent upsert of default blog categories into blog_categories. */
require('./load-env.cjs').loadApiEnv();
const mongoose = require('mongoose');
const { BLOG_CATEGORY_NAMES } = require('./blog-categories.data.cjs');

const URI = process.env.MONGODB_URI;
if (!URI) {
  console.error('SEED BLOG CATEGORIES ERROR: MONGODB_URI is not set (check apps/api/.env)');
  process.exit(1);
}

function slugify(input) {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildSeo(name) {
  const lower = name.toLowerCase();
  const metaTitle = `${name} - Tips, Tricks & Latest Updates`;

  let metaDescription;
  if (/guide|tutorial|how to|setup|recovery|creation|faq|troubleshoot/i.test(name)) {
    metaDescription = `Learn with ${lower} — step-by-step instructions, tips and expert advice on the UniQbd blog.`;
  } else if (/news|updates/i.test(name)) {
    metaDescription = `Stay updated with the latest ${lower} — trends, announcements and marketplace insights from UniQbd.`;
  } else if (/review|comparison/i.test(name)) {
    metaDescription = `Read honest ${lower} — features, pros, cons and buying advice from UniQbd.`;
  } else if (/gift card|top up|recharge|voucher|currency|payment/i.test(name)) {
    metaDescription = `Everything about ${lower} — how to buy, redeem, troubleshoot and get the best value on UniQbd.`;
  } else if (/deal|offer|coupon|sale|discount|flash|exclusive|arrival/i.test(name)) {
    metaDescription = `Discover ${lower} — save more on digital goods with the latest promotions from UniQbd.`;
  } else if (/security|safety|privacy|scam|cyber/i.test(name)) {
    metaDescription = `Protect yourself with ${lower} — practical security advice for digital shoppers on UniQbd.`;
  } else if (/tips|tricks|helpful/i.test(name)) {
    metaDescription = `Explore ${lower}, practical advice and helpful information for digital goods on the UniQbd blog.`;
  } else {
    metaDescription = `Explore ${lower}, tips, tricks and helpful information for popular games and digital products on UniQbd.`;
  }

  const keywords = lower
    .split(/\s+/)
    .filter((word) => word.length > 2)
    .slice(0, 6);

  return {
    metaTitle,
    metaDescription,
    keywords: [...new Set([...keywords, 'uniqbd', 'blog', lower])],
  };
}

(async () => {
  const conn = await mongoose.createConnection(URI).asPromise();
  const collection = conn.collection('blog_categories');
  const now = new Date();

  const slugSet = new Set();
  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const name of BLOG_CATEGORY_NAMES) {
    const slug = slugify(name);
    if (!slug) {
      console.warn(`SKIP: could not slugify "${name}"`);
      skipped += 1;
      continue;
    }
    if (slugSet.has(slug)) {
      console.warn(`SKIP: duplicate slug "${slug}" for "${name}"`);
      skipped += 1;
      continue;
    }
    slugSet.add(slug);

    const seo = buildSeo(name);
    const result = await collection.updateOne(
      { slug },
      {
        $set: {
          name,
          slug,
          description: seo.metaDescription,
          isActive: true,
          seo,
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );

    if (result.upsertedCount > 0) inserted += 1;
    else if (result.modifiedCount > 0) updated += 1;
  }

  const total = await collection.countDocuments();
  console.log(
    `Blog categories seed complete: ${inserted} inserted, ${updated} updated, ${skipped} skipped, ${total} total in collection.`,
  );
  await conn.close();
  process.exit(0);
})().catch((err) => {
  console.error('SEED BLOG CATEGORIES ERROR:', err.message || err);
  process.exit(1);
});
