/**
 * One-off migration: encrypt legacy plaintext delivered codes / serials / PINs
 * on orders and reseller_orders using AES-256-GCM (`enc:v1:` prefix).
 *
 * Dry-run (default):
 *   node apps/api/scripts/encrypt-delivered-codes.cjs
 *
 * Write:
 *   node apps/api/scripts/encrypt-delivered-codes.cjs --apply
 *
 * Also encrypts inventory_items.value.
 *
 * Requires DATA_ENCRYPTION_KEY (32-byte base64) and MONGODB_URI.
 * Does not print code values. Safe to re-run (skips already-prefixed fields).
 * Take a Mongo backup before --apply.
 */
require('./load-env.cjs').loadApiEnv();
const crypto = require('node:crypto');
const mongoose = require('mongoose');

const PREFIX = 'enc:v1:';
const APPLY = process.argv.includes('--apply');
const URI = process.env.MONGODB_URI;
const keyRaw = process.env.DATA_ENCRYPTION_KEY?.trim();

if (!URI) {
  console.error('MONGODB_URI is not set');
  process.exit(1);
}
if (!keyRaw) {
  console.error('DATA_ENCRYPTION_KEY is not set');
  process.exit(1);
}

let key;
try {
  key = Buffer.from(keyRaw, 'base64');
} catch {
  console.error('DATA_ENCRYPTION_KEY is not valid base64');
  process.exit(1);
}
if (key.length !== 32) {
  console.error('DATA_ENCRYPTION_KEY must decode to 32 bytes');
  process.exit(1);
}

function seal(value) {
  if (typeof value !== 'string' || value === '' || value.startsWith(PREFIX)) {
    return { next: value, changed: false };
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(value, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return {
    next: `${PREFIX}${Buffer.concat([iv, tag, ciphertext]).toString('base64')}`,
    changed: true,
  };
}

function sealRecord(record, fields) {
  let changed = false;
  const next = { ...record };
  for (const field of fields) {
    const result = seal(record[field]);
    next[field] = result.next;
    if (result.changed) changed = true;
  }
  return { next, changed };
}

async function migrateCollection(db, name, pathBuilder) {
  const col = db.collection(name);
  const cursor = col.find({});
  let scanned = 0;
  let updated = 0;
  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    scanned += 1;
    const ops = pathBuilder(doc);
    if (!ops.length) continue;
    updated += 1;
    if (APPLY) {
      await col.updateOne({ _id: doc._id }, { $set: Object.fromEntries(ops) });
    }
  }
  return { scanned, updated };
}

function orderSets(doc) {
  const sets = [];
  (doc.items ?? []).forEach((item, i) => {
    (item.deliveredCodes ?? []).forEach((code, j) => {
      const { next, changed } = sealRecord(code, ['code', 'serial', 'pin']);
      if (!changed) return;
      sets.push([`items.${i}.deliveredCodes.${j}.code`, next.code]);
      if (next.serial !== undefined) {
        sets.push([`items.${i}.deliveredCodes.${j}.serial`, next.serial]);
      }
      if (next.pin !== undefined) {
        sets.push([`items.${i}.deliveredCodes.${j}.pin`, next.pin]);
      }
    });
  });
  (doc.manualGiftCards ?? []).forEach((card, i) => {
    const { next, changed } = sealRecord(card, ['code']);
    if (changed) sets.push([`manualGiftCards.${i}.code`, next.code]);
  });
  return sets;
}

(async () => {
  const conn = await mongoose.createConnection(URI).asPromise();
  const db = conn.db;
  function inventorySets(doc) {
    const { next, changed } = sealRecord(doc, ['value']);
    return changed ? [['value', next.value]] : [];
  }

  const inventory = await migrateCollection(db, 'inventory_items', inventorySets);
  const orders = await migrateCollection(db, 'orders', orderSets);
  const reseller = await migrateCollection(db, 'reseller_orders', orderSets);
  console.log(
    APPLY
      ? `Applied encryption. inventory=${inventory.updated}/${inventory.scanned} orders=${orders.updated}/${orders.scanned} reseller_orders=${reseller.updated}/${reseller.scanned}`
      : `Dry-run. Would encrypt inventory=${inventory.updated}/${inventory.scanned} orders=${orders.updated}/${orders.scanned} reseller_orders=${reseller.updated}/${reseller.scanned}. Re-run with --apply to write.`,
  );
  await conn.close();
})().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
