const mongoose = require('mongoose');
const { loadApiEnv } = require('./load-env.cjs');

loadApiEnv();

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const dbName = db.databaseName;

  const products = await db
    .collection('products')
    .find({ status: { $ne: 'archived' } })
    .project({
      title: 1,
      slug: 1,
      status: 1,
      deliveryType: 1,
      stock: 1,
      attributes: 1,
    })
    .toArray();

  console.log('DATABASE:', dbName);
  console.log('URI database:', process.env.MONGODB_URI.split('/').pop().split('?')[0]);
  console.log('ACTIVE PRODUCTS:', products.length);

  for (const product of products) {
    const variations = Array.isArray(product.attributes?.variations)
      ? product.attributes.variations
      : [];
    const inventoryPackages = variations.filter(
      (row) => row.stockType === 'giftcard' || row.stockType === 'api',
    );

    const inventoryRows = await db
      .collection('inventory_items')
      .aggregate([
        { $match: { productId: product._id, status: 'available' } },
        {
          $group: {
            _id: { variationValueId: '$variationValueId' },
            count: { $sum: 1 },
          },
        },
      ])
      .toArray();

    const totalInventory = inventoryRows.reduce((sum, row) => sum + row.count, 0);
    const countByVariation = new Map(
      inventoryRows.map((row) => [
        String(row._id.variationValueId ?? '').trim(),
        row.count,
      ]),
    );

    console.log('\n---');
    console.log('Product:', product.title);
    console.log('ID:', String(product._id));
    console.log('Slug:', product.slug);
    console.log('Status:', product.status, '| Delivery:', product.deliveryType || 'n/a');
    console.log('Cached stock.available:', product.stock?.available ?? 0);
    console.log('Total inventory codes (available):', totalInventory);

    if (inventoryPackages.length > 0) {
      console.log('Auto stock packages:');
      for (const pkg of inventoryPackages) {
        const valueId = String(pkg.valueId ?? '').trim();
        console.log(
          `  - ${pkg.name} | valueId: ${valueId} | type: ${pkg.stockType} | codes: ${countByVariation.get(valueId) ?? 0}`,
        );
      }
      const unassigned = countByVariation.get('') ?? 0;
      if (unassigned > 0) {
        console.log(`  - Unassigned (no package tag): ${unassigned}`);
      }
    } else if (totalInventory > 0) {
      for (const [valueId, count] of countByVariation.entries()) {
        console.log(
          `  - variation: ${valueId || '(none)'} | codes: ${count}`,
        );
      }
    } else {
      console.log('No inventory codes found for this product.');
    }
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
