/* End-to-end live chat smoke test (customer <-> admin). */
require('./load-env.cjs').loadApiEnv();
const { io } = require('../../../node_modules/.pnpm/socket.io-client@4.8.3/node_modules/socket.io-client/build/cjs/index.js');

const API = process.env.API_PUBLIC_URL || 'http://localhost:4000/api';
const WS = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4000';

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

function connectSocket(token, label) {
  return new Promise((resolve, reject) => {
    const socket = io(`${WS}/chat`, {
      auth: { token },
      transports: ['websocket'],
      timeout: 10000,
    });
    const timer = setTimeout(() => {
      socket.disconnect();
      reject(new Error(`${label} socket connect timeout`));
    }, 12000);
    socket.on('connect', () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.on('connect_error', (err) => {
      clearTimeout(timer);
      reject(new Error(`${label} connect_error: ${err.message}`));
    });
  });
}

function waitForEvent(socket, event, predicate, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timeout waiting for ${event}`));
    }, timeoutMs);
    function handler(payload) {
      if (!predicate || predicate(payload)) {
        clearTimeout(timer);
        socket.off(event, handler);
        resolve(payload);
      }
    }
    socket.on(event, handler);
  });
}

function emitAck(socket, event, payload, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Ack timeout for ${event}`)), timeoutMs);
    socket.emit(event, payload, (res) => {
      clearTimeout(timer);
      resolve(res);
    });
  });
}

(async () => {
  console.log('=== Chat E2E test ===');
  console.log('API:', API);
  console.log('WS:', `${WS}/chat`);

  const customer = await login('demo@uniqbd.com', 'Demo1234!');
  const admin = await login('admin@uniqbd.com', 'Admin1234!');
  console.log('Logged in customer:', customer.user.id);
  console.log('Logged in admin:', admin.user.id);

  const room = await api(customer.token, '/chat/rooms/support', { method: 'POST' });
  const roomId = room.id || room._id;
  if (!roomId) throw new Error('No room id from open support');
  console.log('Customer room:', roomId);

  const customerSocket = await connectSocket(customer.token, 'customer');
  const adminSocket = await connectSocket(admin.token, 'admin');
  console.log('Sockets connected');

  const customerJoin = await emitAck(customerSocket, 'room:join', { roomId });
  if (!customerJoin?.ok) throw new Error(`Customer room:join failed: ${JSON.stringify(customerJoin)}`);

  const adminJoin = await emitAck(adminSocket, 'room:join', { roomId });
  if (!adminJoin?.ok) throw new Error(`Admin room:join failed: ${JSON.stringify(adminJoin)}`);

  const customerMsg = `customer ping ${Date.now()}`;
  const adminWait = waitForEvent(
    adminSocket,
    'message:new',
    (m) => m.body === customerMsg,
  );
  const customerSend = await emitAck(customerSocket, 'message:send', {
    roomId,
    body: customerMsg,
  });
  if (!customerSend?.ok) {
    throw new Error(`Customer send failed: ${JSON.stringify(customerSend)}`);
  }
  const adminReceived = await adminWait;
  console.log('Admin received customer message:', adminReceived.body);

  const adminMsg = `admin reply ${Date.now()}`;
  const customerWait = waitForEvent(
    customerSocket,
    'message:new',
    (m) => m.body === adminMsg,
  );
  const adminSend = await emitAck(adminSocket, 'message:send', {
    roomId,
    body: adminMsg,
  });
  if (!adminSend?.ok) {
    throw new Error(`Admin send failed: ${JSON.stringify(adminSend)}`);
  }
  const customerReceived = await customerWait;
  console.log('Customer received admin message:', customerReceived.body);

  const history = await api(customer.token, `/chat/rooms/${roomId}/messages?page=1&limit=20`);
  const bodies = (history.items || []).map((m) => m.body);
  if (!bodies.includes(customerMsg) || !bodies.includes(adminMsg)) {
    throw new Error(`History missing messages: ${JSON.stringify(bodies)}`);
  }
  console.log('History contains both messages');

  customerSocket.disconnect();
  adminSocket.disconnect();
  console.log('PASS: customer <-> admin chat works');
})().catch((err) => {
  console.error('FAIL:', err.message);
  process.exit(1);
});
