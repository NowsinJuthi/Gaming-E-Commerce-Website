const dns = require('node:dns');
const fs = require('fs');
const path = require('path');

// Match apps/api/src/dns-setup.ts so Atlas SRV works on Windows/Linux.
dns.setServers(['8.8.8.8', '8.8.4.4']);
dns.setDefaultResultOrder('ipv4first');

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

/** Load native production env, then local development envs without overriding. */
function loadApiEnv() {
  loadEnvFile('/etc/uniqbd/api.env');
  const rootEnv = path.join(__dirname, '..', '..', '..', '.env');
  const apiEnv = path.join(__dirname, '..', '.env');
  loadEnvFile(rootEnv);
  loadEnvFile(apiEnv);
}

module.exports = { loadApiEnv };
