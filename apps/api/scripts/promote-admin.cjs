/**
 * Grant admin role to an existing user (production recovery).
 *
 * Usage (from repo root on server):
 *   node apps/api/scripts/promote-admin.cjs your@email.com
 *   corepack pnpm --filter @uniqbd/api promote:admin -- your@email.com
 */
require('./load-env.cjs').loadApiEnv();
const mongoose = require('mongoose');

const email = (process.argv[2] || '').trim().toLowerCase();
if (!email || !email.includes('@')) {
  console.error('Usage: node apps/api/scripts/promote-admin.cjs <email>');
  process.exit(1);
}

const URI = process.env.MONGODB_URI;
if (!URI) {
  console.error('ERROR: MONGODB_URI is not set (check .env on server)');
  process.exit(1);
}

const ADMIN_ROLES = ['admin', 'administrator'];

(async () => {
  const conn = await mongoose.createConnection(URI).asPromise();
  const users = conn.collection('users');

  const user = await users.findOne({ email });
  if (!user) {
    console.error(`ERROR: No user found with email ${email}`);
    await conn.close();
    process.exit(1);
  }

  const before = Array.isArray(user.roles) ? user.roles : [];
  const merged = [...new Set([...before, ...ADMIN_ROLES])];

  await users.updateOne(
    { _id: user._id },
    {
      $set: {
        roles: merged,
        status: 'active',
        updatedAt: new Date(),
      },
    },
  );

  console.log(`OK: ${email}`);
  console.log(`  roles before: ${before.join(', ') || '(none)'}`);
  console.log(`  roles after:  ${merged.join(', ')}`);
  console.log('Log out in the browser, then log in again before opening /admin');

  await conn.close();
})().catch((e) => {
  console.error('PROMOTE ADMIN ERROR', e.message);
  process.exit(1);
});
