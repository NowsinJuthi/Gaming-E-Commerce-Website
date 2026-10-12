/**
 * Replace old VPS IP / localhost upload URLs in MongoDB with same-origin paths.
 *
 * Usage (on server):
 *   cd /opt/uniqbd/current
 *   node deploy/deploy/ubuntu22.04/tools/fix-upload-urls.cjs
 */
const path = require('path');
require(path.join(__dirname, '../../../../apps/api/scripts/load-env.cjs')).loadApiEnv();
const mongoose = require('mongoose');

const URI = process.env.MONGODB_URI;

if (!URI) {
  console.error('FAIL: MONGODB_URI is not set in .env');
  process.exit(1);
}

const BAD_ORIGINS = [
  /^https?:\/\/103\.114\.38\.220(?::\d+)?/i,
  /^https?:\/\/127\.0\.0\.1(?::\d+)?/i,
  /^https?:\/\/localhost(?::\d+)?/i,
];

function fixUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return value;

  const trimmed = value.trim().replace(/\/api\/api\//i, '/api/');

  if (trimmed.startsWith('/api/uploads/')) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (!parsed.pathname.startsWith('/api/uploads/')) return value;
    if (!BAD_ORIGINS.some((re) => re.test(parsed.origin))) return value;
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return value;
  }
}

function walkAndFix(node) {
  let changes = 0;

  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i += 1) {
      if (typeof node[i] === 'string') {
        const next = fixUrl(node[i]);
        if (next !== node[i]) {
          node[i] = next;
          changes += 1;
        }
      } else if (node[i] && typeof node[i] === 'object') {
        changes += walkAndFix(node[i]);
      }
    }
    return changes;
  }

  if (!node || typeof node !== 'object') return 0;

  for (const key of Object.keys(node)) {
    const val = node[key];
    if (typeof val === 'string') {
      const next = fixUrl(val);
      if (next !== val) {
        node[key] = next;
        changes += 1;
      }
    } else if (val && typeof val === 'object') {
      changes += walkAndFix(val);
    }
  }

  return changes;
}

(async () => {
  console.log('Normalizing upload URLs to same-origin /api/uploads/ paths');
  const conn = await mongoose.createConnection(URI).asPromise();
  const db = conn.db;

  const collections = await db.listCollections().toArray();
  let totalDocs = 0;
  let totalFields = 0;

  for (const { name } of collections) {
    const col = db.collection(name);
    const cursor = col.find({});
    // eslint-disable-next-line no-await-in-loop
    for await (const doc of cursor) {
      const clone = JSON.parse(JSON.stringify(doc));
      const changes = walkAndFix(clone);
      if (changes > 0) {
        clone._id = doc._id;
        await col.replaceOne({ _id: doc._id }, clone);
        totalDocs += 1;
        totalFields += changes;
        console.log(`  ${name}: updated ${doc._id} (${changes} field(s))`);
      }
    }
  }

  console.log(`\nDone. ${totalDocs} document(s), ${totalFields} URL field(s) fixed.`);
  await conn.close();
})().catch((error) => {
  console.error('FAIL:', error?.message ?? error);
  process.exit(1);
});
