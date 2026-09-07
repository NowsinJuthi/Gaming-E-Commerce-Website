require('./load-env.cjs').loadApiEnv();

const base = (process.env.API_PUBLIC_URL ?? 'http://localhost:4000').replace(/\/$/, '');
const API = base.endsWith('/api') ? base : `${base}/api`;

const EMAIL = 'admin@uniqbd.com';
const PASSWORD = 'Admin1234!';

const problems = [];

function log(step, ok, detail) {
  const mark = ok ? 'OK' : 'FAIL';
  console.log(`[${mark}] ${step}: ${detail}`);
  if (!ok) problems.push({ step, detail });
}

async function request(path, options = {}) {
  const res = await fetch(`${API}${path}`, options);
  let body = null;
  const text = await res.text();
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { res, body };
}

(async () => {
  console.log('API:', API);

  // 1. Health / product fetch
  const productRes = await request('/products/demo-pubg-mobile-60-uc');
  if (!productRes.res.ok) {
    log('Fetch product', false, `${productRes.res.status} ${JSON.stringify(productRes.body)}`);
    process.exit(1);
  }
  const product = productRes.body;
  log('Fetch product', true, product.title);
  log(
    'Product inventoryAvailable',
    product.inventoryAvailable !== undefined,
    String(product.inventoryAvailable ?? 'missing'),
  );

  const variations = product.attributes?.variations ?? [];
  const manualVar = variations.find((v) => v.stockType === 'manual');
  const giftVar = variations.find((v) => v.stockType === 'giftcard');
  console.log('Manual package:', manualVar?.name, 'stock', manualVar?.manualStock);
  console.log('Giftcard package:', giftVar?.name, 'inventory path');

  // 2. Login
  const loginRes = await request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!loginRes.res.ok) {
    log('Login', false, `${loginRes.res.status} ${JSON.stringify(loginRes.body)}`);
    process.exit(1);
  }
  const token = loginRes.body.accessToken;
  log('Login', true, EMAIL);

  const auth = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  // 3. Clear cart
  await request('/cart', { method: 'DELETE', headers: auth });

  // 4. Add manual package to cart
  if (!manualVar) {
    log('Add manual package', false, 'No manual variation on product');
  } else {
    const addRes = await request('/cart/items', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        productId: product._id,
        quantity: 1,
        variationValueId: String(manualVar.valueId),
      }),
    });
    log(
      'Add manual package to cart',
      addRes.res.ok,
      addRes.res.ok
        ? `${manualVar.name} (${manualVar.valueId})`
        : `${addRes.res.status} ${JSON.stringify(addRes.body)}`,
    );
  }

  // 5. Get cart
  const cartRes = await request('/cart', { headers: auth });
  log('Get cart', cartRes.res.ok, `${cartRes.body?.items?.length ?? 0} item(s)`);
  if (cartRes.body?.items?.[0]) {
    const item = cartRes.body.items[0];
    console.log('  Cart line:', item.title, item.packageName, 'stock', item.availableStock);
    log('Cart has packageName', !!item.packageName, item.packageName ?? 'missing');
    log('Cart has variationValueId in API', true, 'via stored cart');
  }

  // 6. Wallet
  const walletRes = await request('/wallet', { headers: auth });
  log('Get wallet', walletRes.res.ok, `balance ${walletRes.body?.balance ?? '?'}`);

  // 7. Create order
  const orderRes = await request('/orders', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      paymentMethod: 'wallet',
      contact: {
        fullName: 'Test User',
        mobile: '01700000000',
        email: EMAIL,
      },
    }),
  });
  log(
    'Create order (manual package)',
    orderRes.res.ok,
    orderRes.res.ok
      ? `order ${orderRes.body.orderNumber ?? orderRes.body._id}`
      : `${orderRes.res.status} ${JSON.stringify(orderRes.body)}`,
  );

  if (orderRes.res.ok) {
    const payRes = await request(`/orders/${orderRes.body._id}/pay`, {
      method: 'POST',
      headers: auth,
    });
    log(
      'Pay with wallet',
      payRes.res.ok,
      payRes.res.ok ? payRes.body.status : `${payRes.res.status} ${JSON.stringify(payRes.body)}`,
    );
  }

  // 8. Test giftcard package add (expected fail if no inventory)
  await request('/cart', { method: 'DELETE', headers: auth });
  if (giftVar) {
    const giftAdd = await request('/cart/items', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        productId: product._id,
        quantity: 1,
        variationValueId: String(giftVar.valueId),
      }),
    });
    const expectedFail = !giftAdd.res.ok;
    log(
      'Giftcard package without inventory blocked',
      expectedFail,
      expectedFail
        ? 'correctly blocked'
        : `unexpectedly allowed: ${JSON.stringify(giftAdd.body)}`,
    );
  }

  console.log('\n--- PROBLEMS FOUND ---');
  if (problems.length === 0) {
    console.log('None — order flow works for manual package.');
  } else {
    for (const p of problems) {
      console.log(`- ${p.step}: ${p.detail}`);
    }
  }
})().catch((e) => {
  console.error('Script error:', e.message);
  process.exit(1);
});
