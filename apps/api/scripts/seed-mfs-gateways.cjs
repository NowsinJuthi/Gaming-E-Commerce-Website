/* Seed default bKash/Nagad MFS checkout numbers (idempotent — skips if any exist). */
require('./load-env.cjs').loadApiEnv();
const mongoose = require('mongoose');

const URI = process.env.MONGODB_URI;
if (!URI) {
  console.error('SEED MFS ERROR: MONGODB_URI is not set (check apps/api/.env)');
  process.exit(1);
}

const schema = new mongoose.Schema(
  {
    name: String,
    provider: String,
    phoneNumber: String,
    minAmount: Number,
    maxAmount: Number,
    isActive: Boolean,
    sortOrder: Number,
  },
  { collection: 'mfs_gateways', timestamps: true },
);

const MfsGateway = mongoose.model('MfsGatewaySeed', schema);

const DEFAULTS = [
  {
    name: 'bKash',
    provider: 'bkash',
    phoneNumber: process.env.MFS_DEFAULT_BKASH_NUMBER?.trim() || '01700000001',
    minAmount: 10,
    maxAmount: 100000,
    isActive: true,
    sortOrder: 0,
  },
  {
    name: 'Nagad',
    provider: 'nagad',
    phoneNumber: process.env.MFS_DEFAULT_NAGAD_NUMBER?.trim() || '01700000002',
    minAmount: 10,
    maxAmount: 100000,
    isActive: true,
    sortOrder: 1,
  },
];

(async () => {
  await mongoose.connect(URI);
  let created = 0;
  for (const row of DEFAULTS) {
    const exists = await MfsGateway.exists({ provider: row.provider });
    if (exists) continue;
    await MfsGateway.create(row);
    created += 1;
    console.log(`Added ${row.name} (${row.provider}): ${row.phoneNumber}`);
  }
  if (created === 0) {
    console.log('All default MFS providers already exist — nothing to seed.');
  } else {
    console.log(
      'Update numbers in Admin → Settings → MFS gateways before taking live payments.',
    );
  }
  await mongoose.disconnect();
})().catch((err) => {
  console.error('SEED MFS ERROR:', err.message || err);
  process.exit(1);
});
