/**
 * E2E guest checkout → admin deliver → verify customer order emails.
 * Requires: API running locally, MongoDB reachable, SMTP configured.
 */
require('../apps/api/scripts/load-env.cjs').loadApiEnv();

const API = (process.argv[2] || 'http://127.0.0.1:4000/api').replace(/\/$/, '');
const ADMIN_EMAIL = process.argv[3] || process.env.TEST_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.argv[4] || process.env.TEST_ADMIN_PASSWORD;
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  throw new Error(
    'Pass admin email/password arguments or set TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD',
  );
}
const TEST_CUSTOMER_EMAIL =
  process.env.TEST_CUSTOMER_EMAIL || `uniqbd-email-test+${Date.now()}@gmail.com`;

async function req(path, { method = 'GET', token, body } = {}) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API}${path}`, {
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

async function findOrderableProduct(guestToken) {
  const slugs = [
    'demo-pubg-mobile-60-uc',
    'pubg-mobile-660-uc',
    'pubg-mobile-uc',
  ];
  for (const slug of slugs) {
    try {
      const product = await req(`/products/${slug}`);
      const variations = product.attributes?.variations ?? [];
      const manualVar = variations.find((v) => v.stockType === 'manual');
      if (manualVar) {
        await req('/cart/items', {
          method: 'POST',
          token: guestToken,
          body: {
            productId: product._id,
            quantity: 1,
            variationValueId: String(manualVar.valueId),
          },
        });
        return { product, manualVar };
      }
    } catch {
      /* try next */
    }
  }

  const list = await req('/products?limit=50');
  const items = list.items ?? list;
  for (const candidate of items) {
    const id = candidate._id || candidate.id;
    if (!id) continue;
    try {
      await req('/cart/items', {
        method: 'POST',
        token: guestToken,
        body: { productId: id, quantity: 1 },
      });
      return { product: candidate, manualVar: null };
    } catch {
      /* next */
    }
  }
  return null;
}

(async () => {
  console.log('API:', API);
  console.log('Customer email:', TEST_CUSTOMER_EMAIL);

  const guestAuth = await req('/auth/guest', { method: 'POST' });
  const guestToken = guestAuth.accessToken;
  console.log('✓ Guest session');

  const picked = await findOrderableProduct(guestToken);
  if (!picked) {
    throw new Error('No orderable product (manual package or in-stock item)');
  }
  console.log(
    '✓ Cart:',
    picked.product.title,
    picked.manualVar ? `(manual: ${picked.manualVar.name})` : '',
  );

  const panel = await req('/customer-panel/config');
  const checkout = panel?.checkout ?? {};
  const paymentMethod = checkout.manualEnabled !== false ? 'manual' : checkout.gatewayEnabled ? 'gateway' : 'wallet';

  const order = await req('/orders', {
    method: 'POST',
    token: guestToken,
    body: {
      paymentMethod,
      contact: {
        fullName: 'Email E2E Tester',
        mobile: '01700000099',
        email: TEST_CUSTOMER_EMAIL,
      },
      note: 'Automated customer email test',
    },
  });
  const orderId = order._id || order.id;
  console.log(`✓ Order #${order.orderNumber} (${orderId})`);

  console.log('… waiting 4s for order confirmation email');
  await sleep(4000);

  const adminAuth = await req('/auth/login', {
    method: 'POST',
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  const roles = adminAuth.user?.roles ?? [];
  console.log(`✓ Logged in ${ADMIN_EMAIL} roles=[${roles.join(', ')}]`);
  if (!roles.includes('admin') && !roles.includes('support')) {
    console.log('\n⚠ Cannot complete order — run: node apps/api/scripts/make-admin.cjs admin@uniqbd.com');
    console.log('Order confirmation email was still attempted at create time.');
    process.exit(0);
  }

  const adminToken = adminAuth.accessToken;
  await req(`/orders/${orderId}/status`, {
    method: 'PATCH',
    token: adminToken,
    body: {
      status: 'delivered',
      note: 'E2E email test',
      deliveryMessage: 'Test code: EMAIL-E2E-OK',
    },
  });
  console.log('✓ Order marked delivered');

  console.log('… waiting 4s for delivery email');
  await sleep(4000);

  const emailSettings = await req('/email/admin/settings', { token: adminToken });
  console.log('\n--- Email settings ---');
  console.log('  enabled:', emailSettings.settings?.enabled);
  console.log('  mockMode:', emailSettings.settings?.mockMode);
  console.log('  SMTP configured:', emailSettings.smtp?.configured);

  console.log('\n--- Check API logs for ---');
  console.log(`  order confirmation email sent for order ${order.orderNumber} to ${TEST_CUSTOMER_EMAIL}`);
  console.log(`  order delivered email sent for order ${order.orderNumber} to ${TEST_CUSTOMER_EMAIL}`);
  console.log('\nIf logs say "skipped", enable SMTP + order.processing / order.completed templates.');
})().catch((err) => {
  console.error('\n✗', err.message);
  process.exit(1);
});
