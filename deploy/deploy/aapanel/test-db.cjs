const path = require('path');
require(path.join(__dirname, '../../apps/api/scripts/load-env.cjs')).loadApiEnv();
const mongoose = require('mongoose');

const URI = process.env.MONGODB_URI;
if (!URI) {
  console.error('FAIL: MONGODB_URI is not set in .env');
  process.exit(1);
}

(async () => {
  const conn = await mongoose.createConnection(URI, {
    serverSelectionTimeoutMS: 10000,
    family: 4,
  }).asPromise();
  const dbName = conn.db.databaseName;
  const cols = await conn.db.listCollections().toArray();
  console.log(`OK: connected to database "${dbName}" (${cols.length} collections)`);
  await conn.close();
})().catch((error) => {
  const message = error?.message ?? String(error);
  console.error('FAIL:', message);
  if (/whitelist|Server selection timed out|ECONNREFUSED|ENOTFOUND/i.test(message)) {
    console.error(`
Fix checklist:
  1. MongoDB Atlas → Network Access → Add IP Address
     Run: curl -4 ifconfig.me
     Add that IP (or temporarily 0.0.0.0/0 for testing)
  2. Atlas → Database Access → user has readWrite on your DB
  3. .env MONGODB_URI must be mongodb+srv://... (Atlas), not 127.0.0.1
  4. Password special chars must be URL-encoded (@ → %40, # → %23)
  5. pm2 restart uniqbd-api after fixing .env
`);
  }
  process.exit(1);
});
