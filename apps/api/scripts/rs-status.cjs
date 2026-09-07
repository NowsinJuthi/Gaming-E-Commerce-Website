const mongoose = require('mongoose');
const URI = 'mongodb://127.0.0.1:27018/?directConnection=true';
(async () => {
  const conn = await mongoose.createConnection(URI).asPromise();
  const admin = conn.db.admin();
  const hello = await admin.command({ hello: 1 });
  console.log('isWritablePrimary:', hello.isWritablePrimary);
  console.log('secondary:', hello.secondary);
  console.log('setName:', hello.setName);
  try {
    const st = await admin.command({ replSetGetStatus: 1 });
    console.log('members:', st.members.map((m) => `${m.name}=${m.stateStr}`).join(', '));
  } catch (e) {
    console.log('status err:', e.codeName || e.message);
  }
  await conn.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
