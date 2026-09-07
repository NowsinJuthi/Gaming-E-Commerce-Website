const mongoose = require('mongoose');
const { loadApiEnv } = require('./load-env.cjs');

loadApiEnv();

const productId = process.argv[2];
const execute = process.argv.includes('--execute');

if (!productId) {
  console.error('Usage: node purge-unassigned-inventory.cjs <productId> [--execute]');
  process.exit(1);
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const productObjectId = new mongoose.Types.ObjectId(productId);

  const product = await db.collection('products').findOne({ _id: productObjectId });
  if (!product) {
    console.error('Product not found:', productId);
    process.exit(1);
  }

  const variations = Array.isArray(product.attributes?.variations)
    ? product.attributes.variations
    : [];
  const packageIds = new Set(
    variations
      .map((row) => String(row?.valueId ?? '').trim())
      .filter(Boolean),
  );

  const all = await db
    .collection('inventory_items')
    .find({ productId: productObjectId })
    .project({ variationValueId: 1, status: 1 })
    .toArray();

  const unassigned = all.filter((row) => {
    const valueId = String(row.variationValueId ?? '').trim();
    return !valueId || !packageIds.has(valueId);
  });

  const deletable = unassigned.filter(
    (row) => row.status === 'available' || row.status === 'disabled',
  );

  console.log('Product:', product.title ?? product.slug ?? productId);
  console.log('Total inventory items:', all.length);
  console.log('Unassigned items:', unassigned.length);
  console.log('Deletable (available/disabled):', deletable.length);

  if (!execute) {
    console.log('\nDry run only. Pass --execute to delete.');
    await mongoose.disconnect();
    return;
  }

  if (deletable.length === 0) {
    console.log('Nothing to delete.');
    await mongoose.disconnect();
    return;
  }

  const result = await db.collection('inventory_items').deleteMany({
    _id: { $in: deletable.map((row) => row._id) },
  });

  const grouped = await db
    .collection('inventory_items')
    .aggregate([
      { $match: { productId: productObjectId } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ])
    .toArray();

  const counts = { available: 0, reserved: 0, sold: 0 };
  for (const row of grouped) {
    if (row._id === 'available') counts.available = row.count;
    else if (row._id === 'reserved') counts.reserved = row.count;
    else if (row._id === 'sold') counts.sold = row.count;
  }

  await db.collection('products').updateOne(
    { _id: productObjectId },
    { $set: { stock: counts } },
  );

  console.log('Deleted:', result.deletedCount);
  console.log('Updated product stock:', counts);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
