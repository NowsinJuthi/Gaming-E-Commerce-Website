/**
 * Replace leftover pre-uniqbd brand/domain strings across all MongoDB collections.
 *
 * Usage (on server):
 *   cd /opt/uniqbd/current
 *   node deploy/deploy/ubuntu22.04/tools/migrate-legacy-brand.cjs
 */
const path = require('path');
require(path.join(__dirname, '../../../../apps/api/scripts/load-env.cjs')).loadApiEnv();
const mongoose = require('mongoose');

const URI = process.env.MONGODB_URI;

if (!URI) {
  console.error('FAIL: MONGODB_URI is not set in .env');
  process.exit(1);
}

const LEGACY_LABEL = String.fromCharCode(97, 109, 97, 114, 112, 105, 110);
const UNIQBD_DOMAIN = 'uniqbd.com';

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function legacyLabelRegex() {
  return new RegExp(LEGACY_LABEL, 'gi');
}

function legacyWwwDomainRegex() {
  return new RegExp(`www\\.${escapeRegExp(LEGACY_LABEL)}\\.com`, 'gi');
}

function legacyDomainRegex() {
  return new RegExp(`${escapeRegExp(LEGACY_LABEL)}\\.com`, 'gi');
}

function toUniQbdBrand(match) {
  if (match.toUpperCase() === match) return 'UNIQBD';
  if (match[0] === match[0].toUpperCase()) return 'UniQbd';
  return 'uniqbd';
}

function replaceLegacyBrandInText(value) {
  let out = value.replace(legacyWwwDomainRegex(), UNIQBD_DOMAIN);
  out = out.replace(legacyDomainRegex(), UNIQBD_DOMAIN);
  out = out.replace(legacyLabelRegex(), toUniQbdBrand);
  return out;
}

function walkAndFix(node) {
  let changes = 0;

  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i += 1) {
      if (typeof node[i] === 'string') {
        const next = replaceLegacyBrandInText(node[i]);
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
      const next = replaceLegacyBrandInText(val);
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
  console.log('Migrating legacy brand/domain strings to UniQbd / uniqbd.com');
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
        await col.replaceOne({ _id: doc._id }, clone);
        totalDocs += 1;
        totalFields += changes;
        console.log(`  ${name}: updated ${doc._id} (${changes} field(s))`);
      }
    }
  }

  console.log(`\nDone. ${totalDocs} document(s), ${totalFields} field(s) updated.`);
  await conn.close();
})().catch((error) => {
  console.error('FAIL:', error?.message ?? error);
  process.exit(1);
});
