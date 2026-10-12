/* Verify staff notification is created when customer sends chat. */
require('./load-env.cjs').loadApiEnv();
const { io } = require('../../../node_modules/.pnpm/socket.io-client@4.8.3/node_modules/socket.io-client/build/cjs/index.js');

const API = process.env.API_PUBLIC_URL || 'http://localhost:4000/api';
const WS = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4000';
const CUSTOMER_EMAIL = process.env.TEST_CUSTOMER_EMAIL;
const CUSTOMER_PASSWORD = process.env.TEST_CUSTOMER_PASSWORD;
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD;
if (!CUSTOMER_EMAIL || !CUSTOMER_PASSWORD || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
  throw new Error(
    'Set TEST_CUSTOMER_EMAIL, TEST_CUSTOMER_PASSWORD, TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD',
  );
}

async function login(email, password) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Login failed: ${email}`);
  return data.accessToken;
}

async function unreadStaff(token) {
  const res = await fetch(`${API}/notifications/unread-count?audience=staff`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return (await res.json()).count;
}

function emitAck(socket, event, payload) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout ${event}`)), 10000);
    socket.emit(event, payload, (res) => {
      clearTimeout(timer);
      resolve(res);
    });
  });
}

(async () => {
  const customerToken = await login(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
  const adminToken = await login(ADMIN_EMAIL, ADMIN_PASSWORD);

  const before = await unreadStaff(adminToken);
  console.log('Staff unread before:', before);

  const room = await fetch(`${API}/chat/rooms/support`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${customerToken}` },
  }).then((r) => r.json());
  const roomId = room.id || room._id;

  const socket = io(`${WS}/chat`, {
    auth: { token: customerToken },
    transports: ['websocket'],
  });
  await new Promise((r) => socket.on('connect', r));
  await emitAck(socket, 'room:join', { roomId });

  const body = `staff notify test ${Date.now()}`;
  const send = await emitAck(socket, 'message:send', { roomId, body });
  if (!send?.ok) throw new Error(`send failed: ${JSON.stringify(send)}`);
  socket.disconnect();

  await new Promise((r) => setTimeout(r, 500));
  const after = await unreadStaff(adminToken);
  console.log('Staff unread after:', after);

  if (after <= before) {
    throw new Error('Staff notification count did not increase');
  }
  console.log('PASS: chat creates staff notification');
})().catch((e) => {
  console.error('FAIL:', e.message);
  process.exit(1);
});
