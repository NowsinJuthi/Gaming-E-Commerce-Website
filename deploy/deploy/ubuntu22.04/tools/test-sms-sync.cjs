/**
 * Test MFS SMS sync on the server (simulates Paymently app).
 *
 * Usage:
 *   cd /opt/uniqbd/current
 *   ADMIN_EMAIL=admin@uniqbd.com ADMIN_PASS='...' node deploy/deploy/ubuntu22.04/tools/test-sms-sync.cjs
 *
 * Optional env:
 *   API_BASE=https://api.uniqbd.com/api
 *   SMS_BODY="You have received payment Tk 780.00 ..."
 */
const path = require('path');
require(path.join(__dirname, '../../../../apps/api/scripts/load-env.cjs')).loadApiEnv();

const API_BASE = (process.env.API_BASE || process.env.API_PUBLIC_URL || 'https://api.uniqbd.com/api').replace(
  /\/$/,
  '',
);
const APP_BASE = API_BASE.replace(/\/api$/, '');
const EMAIL = process.env.ADMIN_EMAIL;
const PASSWORD = process.env.ADMIN_PASS;
if (!EMAIL || !PASSWORD) {
  throw new Error('Set ADMIN_EMAIL and ADMIN_PASS');
}
const SMS_BODY =
  process.env.SMS_BODY ||
  process.env.NAGAD_SMS ||
  'You have received payment Tk 780.00 from 01330231089. Fee Tk 0.00. Balance Tk 5,495.00. TrxID DEI4C6XD3M at 18/05/2026 14:25';
const PAYMENT_METHOD = process.env.PAYMENT_METHOD || 'bkash';

async function main() {
  console.log('API:', API_BASE);
  console.log('Login:', EMAIL);

  const loginRes = await fetch(`${APP_BASE}/api/app/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const loginJson = await loginRes.json();
  if (!loginRes.ok || loginJson.status !== 'success') {
    console.error('LOGIN FAIL:', loginRes.status, loginJson);
    process.exit(1);
  }

  const token =
    loginJson.data?.access_token || loginJson.data?.accessToken || loginJson.data?.token;
  if (!token) {
    console.error('LOGIN FAIL: no token in response');
    process.exit(1);
  }
  console.log('Login OK');

  const smsRes = await fetch(`${APP_BASE}/api/app/sms/store`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      payment_method: PAYMENT_METHOD,
      message: SMS_BODY,
      body: SMS_BODY,
    }),
  });
  const smsJson = await smsRes.json();
  console.log('SMS sync:', smsRes.status, smsJson);

  if (!smsRes.ok) {
    process.exit(1);
  }
  console.log('\nCheck admin → Sales → SMS logs for TrxID DEI4C6XD3M');
}

main().catch((err) => {
  console.error('FAIL:', err.message);
  process.exit(1);
});
