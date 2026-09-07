/* Seed demo admin + customer accounts (idempotent upserts). */
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

const USERS = [
  {
    email: 'admin@uniqbd.com',
    password: 'Admin1234!',
    roles: ['admin'],
    status: 'active',
    emailVerified: true,
    profile: { firstName: 'Admin', displayName: 'Admin' },
  },
  {
    email: 'demo@uniqbd.com',
    password: 'Demo1234!',
    roles: ['customer'],
    status: 'active',
    emailVerified: true,
    profile: { firstName: 'Demo', displayName: 'Demo User' },
  },
];

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
    console.log(`  ${u.email} / ${u.password} (${u.roles.join(', ')})`);
  }

  console.log(`SEED USERS OK: ${USERS.length} accounts`);
  await conn.close();
})().catch((e) => {
  console.error('SEED USERS ERROR', e.message);
  process.exit(1);
});
