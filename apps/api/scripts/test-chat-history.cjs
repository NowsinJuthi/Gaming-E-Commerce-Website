/* Verify support chat history survives page reload / closed room reopen. */
require('./load-env.cjs').loadApiEnv();

const API = process.env.API_PUBLIC_URL || 'http://localhost:4000/api';

async function login(email, password) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(`Login failed for ${email}: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return { token: data.accessToken, user: data.user };
}

async function api(token, path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    throw new Error(`API ${path} failed: ${res.status} ${text}`);
  }
  return body;
}

(async () => {
  console.log('=== Chat history persistence test ===');

  const customer = await login('demo@uniqbd.com', 'Demo1234!');
  const admin = await login('admin@uniqbd.com', 'Admin1234!');

  const room = await api(customer.token, '/chat/rooms/support', { method: 'POST' });
  const roomId = room.id || room._id;
  if (!roomId) throw new Error('No room id');

  const marker = `persist-check ${Date.now()}`;
  const { io } = require('../../../node_modules/.pnpm/socket.io-client@4.8.3/node_modules/socket.io-client/build/cjs/index.js');
  const WS = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4000';

  const socket = io(`${WS}/chat`, {
    auth: { token: customer.token },
    transports: ['websocket'],
  });
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('socket timeout')), 10000);
    socket.on('connect', () => {
      clearTimeout(t);
      resolve();
    });
    socket.on('connect_error', (e) => {
      clearTimeout(t);
      reject(e);
    });
  });

  const sendRes = await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('send ack timeout')), 10000);
    socket.emit('message:send', { roomId, body: marker }, (res) => {
      clearTimeout(t);
      resolve(res);
    });
  });
  if (!sendRes?.ok) throw new Error(`Send failed: ${JSON.stringify(sendRes)}`);
  socket.disconnect();

  const history1 = await api(
    customer.token,
    `/chat/rooms/${roomId}/messages?page=1&limit=50`,
  );
  if (!(history1.items || []).some((m) => m.body === marker)) {
    throw new Error('Message missing right after send');
  }
  console.log('Message saved to DB');

  await api(admin.token, `/chat/rooms/${roomId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'closed' }),
  });
  console.log('Room closed by admin');

  const reopened = await api(customer.token, '/chat/rooms/support', { method: 'POST' });
  const reopenedId = reopened.id || reopened._id;
  if (reopenedId !== roomId) {
    throw new Error(
      `Expected same room after reopen, got ${reopenedId} vs ${roomId}`,
    );
  }
  console.log('Customer reopened same support room');

  const history2 = await api(
    customer.token,
    `/chat/rooms/${reopenedId}/messages?page=1&limit=50`,
  );
  if (!(history2.items || []).some((m) => m.body === marker)) {
    throw new Error('History lost after room close + reopen');
  }

  await api(admin.token, `/chat/rooms/${roomId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'open' }),
  });

  console.log('PASS: support conversation history persists');
})().catch((err) => {
  console.error('FAIL:', err.message);
  process.exit(1);
});
