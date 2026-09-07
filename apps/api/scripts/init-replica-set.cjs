/* One-time: initialize a single-node replica set so MongoDB transactions work. */
const mongoose = require('mongoose');

(async () => {
  const uri = 'mongodb://127.0.0.1:27018/?directConnection=true';
  const conn = await mongoose.createConnection(uri).asPromise();
  const admin = conn.db.admin();
  try {
    const status = await admin.command({ replSetGetStatus: 1 }).catch(() => null);
    if (status && status.ok) {
      console.log('ALREADY_INITIATED');
    } else {
      const res = await admin.command({
        replSetInitiate: {
          _id: 'rs0',
          members: [{ _id: 0, host: '127.0.0.1:27018' }],
        },
      });
      console.log('INITIATED', JSON.stringify(res));
    }
  } catch (e) {
    if (e.codeName === 'AlreadyInitialized') {
      console.log('ALREADY_INITIATED');
    } else {
      console.error('ERROR', e.codeName || e.message);
      process.exitCode = 1;
    }
  } finally {
    await conn.close();
  }
})();
