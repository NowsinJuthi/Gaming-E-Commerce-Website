/**
 * E2E: guest order → admin mark delivered → verify customer email send logs.
 * Usage: node scripts/test-order-emails.mjs [API_BASE] [ADMIN_EMAIL] [ADMIN_PASSWORD]
 */
const API_BASE = (process.argv[2] || 'http://127.0.0.1:4000/api').replace(/\/$/, '');
const ADMIN_EMAIL = process.argv[3] || process.env.TEST_ADMIN_EMAIL || '';
const ADMIN_PASSWORD = process.argv[4] || process.env.TEST_ADMIN_PASSWORD || '';
const TEST_CUSTOMER_EMAIL =
  process.env.TEST_CUSTOMER_EMAIL || `uniqbd-email-test+${Date.now()}@gmail.com`;

async function req(path, { method = 'GET', token, body } = {}) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const msg =
      typeof data === 'object' && data?.message
        ? Array.isArray(data.message)
          ? data.message.join(', ')
          : data.message
        : text.slice(0, 300);
    throw new Error(`${method} ${path} → ${res.status}: ${msg}`);
  }
  return data;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log(`API: ${API_BASE}`);
  console.log(`Customer test email: ${TEST_CUSTOMER_EMAIL}`);

  const guestAuth = await req('/auth/guest', { method: 'POST' });
  const guestToken = guestAuth.accessToken;
  console.log('✓ Guest session created');

  const products = await req('/products?limit=50');
  const productList = products.items ?? products;
  if (!Array.isArray(productList) || productList.length === 0) {
    throw new Error('No products found for test order');
  }

  let product = null;
  let productId = null;
  for (const candidate of productList) {
    const id = candidate._id || candidate.id;
    if (!id) continue;
    try {
      await req('/cart/items', {
        method: 'POST',
        token: guestToken,
        body: { productId: id, quantity: 1 },
      });
      product = candidate;
      productId = id;
      break;
    } catch {
      /* try next product */
    }
  }
  if (!product || !productId) {
    throw new Error('No in-stock product available for test order');
  }
  console.log(`✓ Using product: ${product.title || product.name || productId}`);
  console.log('✓ Added to cart');

  const panel = await req('/customer-panel/config');
  const methods = panel?.checkout || {};
  let paymentMethod = 'manual';
  if (methods.manualEnabled === false) {
    if (methods.gatewayEnabled) paymentMethod = 'gateway';
    else if (methods.walletEnabled) paymentMethod = 'wallet';
    else throw new Error('No payment method enabled for test');
  }

  const order = await req('/orders', {
    method: 'POST',
    token: guestToken,
    body: {
      paymentMethod,
      contact: {
        fullName: 'Email Test Buyer',
        mobile: '01700000099',
        email: TEST_CUSTOMER_EMAIL,
      },
      note: 'Automated email E2E test — safe to cancel',
    },
  });
  const orderId = order._id || order.id;
  console.log(`✓ Order placed: #${order.orderNumber} (${orderId}) payment=${paymentMethod}`);

  console.log('\n--- Wait 3s for order confirmation email (async) ---');
  await sleep(3000);

  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.log('\n⚠ Skipping admin complete — set TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD');
    console.log('Order confirmation email should have been attempted at order create.');
    return;
  }

  const adminAuth = await req('/auth/login', {
    method: 'POST',
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  const adminToken = adminAuth.accessToken;
  const adminRoles = adminAuth.user?.roles ?? [];
  console.log(`✓ Admin logged in (roles: ${adminRoles.join(', ') || 'none'})`);
  if (!adminRoles.includes('admin') && !adminRoles.includes('support')) {
    throw new Error(
      `Account ${ADMIN_EMAIL} is not admin/support — cannot complete order in test`,
    );
  }

  if (order.status === 'pending' && paymentMethod === 'manual') {
    await req(`/orders/${orderId}/status`, {
      method: 'PATCH',
      token: adminToken,
      body: { status: 'paid', note: 'E2E test — mark paid' },
    });
    console.log('✓ Marked order paid (manual)');
    await sleep(1000);
  }

  await req(`/orders/${orderId}/status`, {
    method: 'PATCH',
    token: adminToken,
    body: {
      status: 'delivered',
      note: 'E2E test delivery',
      deliveryMessage: 'Test delivery code: E2E-12345',
    },
  });
  console.log('✓ Marked order delivered');

  console.log('\n--- Wait 3s for delivery email (async) ---');
  await sleep(3000);

  console.log('\nDone. Check API logs for:');
  console.log(`  "order confirmation email sent for order ${order.orderNumber} to ${TEST_CUSTOMER_EMAIL}"`);
  console.log(`  "order delivered email sent for order ${order.orderNumber} to ${TEST_CUSTOMER_EMAIL}"`);
  console.log('\nIf you see "skipped" instead, enable SMTP + order.processing / order.completed templates in Admin → Email.');
}

main().catch((err) => {
  console.error('\n✗ Test failed:', err.message);
  process.exit(1);
});
