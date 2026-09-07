const API = "http://localhost:4000/api";

async function login() {
  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: "admin@uniqbd.com",
      password: "Admin1234!",
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "login failed");
  return data.accessToken;
}

async function getStatus(token) {
  const res = await fetch(`${API}/license/admin/status`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "status failed");
  return data;
}

async function activate(token) {
  const res = await fetch(`${API}/license/admin/activate`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  return { status: res.status, data };
}

const token = await login();
const status = await getStatus(token);

console.log("CONFIGURED", status.configured);
console.log("VALID", status.valid);
console.log("CODE", status.code || "—");
console.log("STATUS", status.status || "—");
console.log("MESSAGE", status.message || "—");
console.log("GRACE", status.grace);
console.log("CACHED", status.cached);
console.log("HAS_SITE_SECRET", status.hasSiteSecret);
console.log("WEBSITE_ID", status.websiteId || "(empty)");
console.log("PRODUCT_ID", status.productId || "(empty)");
console.log("INSTALLATION_ID", status.installationId || "(empty)");
console.log("LICENSE_MASKED", status.licenseKeyMasked || "(empty)");
console.log(
  "FEATURES",
  Object.entries(status.features || {})
    .filter(([, v]) => v)
    .map(([k]) => k)
    .join(", ") || "(none enabled)",
);

const act = await activate(token);
console.log("ACTIVATE_HTTP", act.status);
console.log("ACTIVATE_MSG", act.data?.message || act.data?.code || act.data?.raw || "—");
