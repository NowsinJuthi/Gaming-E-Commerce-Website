/* Seed explicitly configured accounts (idempotent upserts). */
require('./load-env.cjs').loadApiEnv();
const mongoose = require('mongoose');
const { randomBytes, scrypt: scryptCallback } = require('node:crypto');
const { promisify } = require('node:util');

const scrypt = promisify(scryptCallback);

const URI = process.env.MONGODB_URI;
if (!URI) {
  console.error('SEED USERS ERROR: MONGODB_URI is not set (check apps/api/.env)');
  process.exit(1);
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derived = await scrypt(password, salt, 64);
  return `${salt}:${derived.toString('hex')}`;
}

const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
const adminPassword = process.env.SEED_ADMIN_PASSWORD;
if (!adminEmail || !adminPassword) {
  console.error(
    'SEED USERS ERROR: set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD explicitly',
  );
  process.exit(1);
}
if (adminPassword.length < 14) {
  console.error('SEED USERS ERROR: SEED_ADMIN_PASSWORD must be at least 14 characters');
  process.exit(1);
}

const USERS = [{
  email: adminEmail,
  password: adminPassword,
  roles: ['admin'],
  status: 'active',
  emailVerified: true,
  profile: { firstName: 'Admin', displayName: 'Admin' },
}];

const demoEmail = process.env.SEED_DEMO_EMAIL?.trim().toLowerCase();
const demoPassword = process.env.SEED_DEMO_PASSWORD;
if (demoEmail || demoPassword) {
  if (!demoEmail || !demoPassword || demoPassword.length < 14) {
    console.error(
      'SEED USERS ERROR: optional demo account requires SEED_DEMO_EMAIL and a SEED_DEMO_PASSWORD of at least 14 characters',
    );
    process.exit(1);
  }
  USERS.push({
    email: demoEmail,
    password: demoPassword,
    roles: ['customer'],
    status: 'active',
    emailVerified: true,
    profile: { firstName: 'Demo', displayName: 'Demo User' },
  });
}

(async () => {
  const conn = await mongoose.createConnection(URI).asPromise();
  const users = conn.collection('users');
  const now = new Date();

  for (const u of USERS) {
    const passwordHash = await hashPassword(u.password);
    await users.updateOne(
      { email: u.email },
      {
        $set: {
          email: u.email,
          passwordHash,
          roles: u.roles,
          status: u.status,
          emailVerified: u.emailVerified,
          profile: u.profile,
          kycStatus: 'none',
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );
    console.log(`  ${u.email} (${u.roles.join(', ')})`);
  }

  console.log(`SEED USERS OK: ${USERS.length} accounts`);
  await conn.close();
})().catch((e) => {
  console.error('SEED USERS ERROR', e.message);
  process.exit(1);
});
