/**
 * Test MongoDB connection and seed default login accounts.
 * Usage: node scripts/db-setup.cjs [--with-catalog]
 */
require('./load-env.cjs').loadApiEnv();
const mongoose = require('mongoose');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const URI = process.env.MONGODB_URI;
const withCatalog = process.argv.includes('--with-catalog');

if (!URI) {
  console.error('DB SETUP ERROR: MONGODB_URI is not set (check apps/api/.env)');
  process.exit(1);
}

function runScript(name) {
  const scriptPath = path.join(__dirname, name);
  const result = spawnSync(process.execPath, [scriptPath], {
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

(async () => {
  console.log('Connecting to MongoDB…');
  const conn = await mongoose.createConnection(URI).asPromise();
  const db = conn.db;
  const cols = await db.listCollections().toArray();
  console.log(`CONNECTED: database "${db.databaseName}" (${cols.length} collections)`);
  await conn.close();

  console.log('\nSeeding explicitly configured login accounts…');
  runScript('seed-users.cjs');

  if (withCatalog) {
    console.log('\nSeeding demo categories + products…');
    runScript('seed.cjs');
  }

  console.log('\nDB SETUP OK');
  console.log('Credentials were read from SEED_ADMIN_* / optional SEED_DEMO_* variables.');
})().catch((error) => {
  const message = error?.message ?? String(error);
  console.error('\nDB SETUP ERROR:', message);
  if (/whitelist|Server selection timed out/i.test(message)) {
    console.error(`
MongoDB Atlas blocked this server IP. Fix in Atlas dashboard:
  1. https://cloud.mongodb.com → your project → Network Access
  2. Add IP Address → your VPS IP from: curl -4 ifconfig.me
  3. Database Access → user needs readWrite on database "UniQbdWebData"
  4. Re-run: corepack pnpm db:setup
`);
  }
  process.exit(1);
});
