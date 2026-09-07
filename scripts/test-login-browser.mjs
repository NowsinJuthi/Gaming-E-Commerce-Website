import { chromium } from "playwright";

const email = "admin@uniqbd.com";
const password = "Admin1234!";

let loginRequest = null;
let consoleErrors = [];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

page.on("console", (msg) => {
  if (msg.type() === "error") {
    consoleErrors.push(msg.text());
  }
});

page.on("request", (req) => {
  if (req.url().includes("/api/auth/login") && req.method() === "POST") {
    loginRequest = req.url();
  }
});

page.on("response", async (res) => {
  if (res.url().includes("/api/auth/login") && res.request().method() === "POST") {
    console.log("LOGIN_RESPONSE", res.status(), await res.text().catch(() => ""));
  }
});

await page.goto("http://localhost:3000/login", {
  waitUntil: "networkidle",
  timeout: 120000,
});

await page.waitForSelector("#login-email", { timeout: 60000 });

// Wait for React hydration (button must be interactive, not stuck on SSR shell)
await page.waitForFunction(
  () => {
    const btn = document.querySelector('button.btn-primary');
    return btn && !btn.disabled && btn.textContent?.includes("Log in");
  },
  { timeout: 60000 },
);

const emailInput = page.locator("#login-email");
const passwordInput = page.locator("#login-password");

await emailInput.click();
await emailInput.fill("");
await emailInput.pressSequentially(email, { delay: 20 });

await passwordInput.click();
await passwordInput.fill("");
await passwordInput.pressSequentially(password, { delay: 20 });

// Confirm React state received the values
const emailVal = await emailInput.inputValue();
const passLen = (await passwordInput.inputValue()).length;
console.log("FIELD_VALUES", { email: emailVal, passLen });

await page.click('button:has-text("Log in")');

await page.waitForURL(
  (url) => url.pathname.startsWith("/admin") || url.pathname === "/dashboard",
  { timeout: 15000 },
).catch(() => {});

await page.waitForTimeout(2000);

const url = page.url();
const token = await page.evaluate(() => localStorage.getItem("accessToken"));
const errorText = await page
  .locator(".login-page__alert--error")
  .textContent()
  .catch(() => null);

console.log("FINAL_URL", url);
console.log("ACCESS_TOKEN", token ? "stored" : "missing");
console.log("LOGIN_REQUEST", loginRequest ?? "none");
console.log("INLINE_ERROR", errorText?.trim() || "none");
console.log("CONSOLE_ERRORS", consoleErrors.slice(0, 5));

await browser.close();

if (!token && !url.includes("/admin") && !url.includes("/dashboard")) {
  process.exit(1);
}
