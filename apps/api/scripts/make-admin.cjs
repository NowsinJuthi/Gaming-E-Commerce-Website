/* Promote a user to admin + mark verified/active. Usage: node make-admin.cjs <email> */
require('./load-env.cjs').loadApiEnv();
const mongoose = require('mongoose');

const URI =
  process.env.MONGODB_URI ||
  'mongodb://127.0.0.1:27018/uniqbd?replicaSet=rs0';
const email = (process.argv[2] || '').toLowerCase();

(async () => {
  if (!email) {
    console.error('Provide an email');
    process.exit(1);
  }
  const conn = await mongoose.createConnection(URI).asPromise();
  const res = await conn.collection('users').updateOne(
    { email },
    { $set: { roles: ['admin', 'customer'], emailVerified: true, status: 'active' } },
  );
  console.log(res.matchedCount ? `ADMIN OK: ${email}` : `NOT FOUND: ${email}`);
  await conn.close();
})().catch((e) => {
  console.error('ERROR', e.message);
  process.exit(1);
});
