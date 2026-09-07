/**
 * PM2 process file for aaPanel / VPS.
 *
 * Start: cd /www/wwwroot/uniqbd.com && pm2 start deploy/deploy/aapanel/ecosystem.config.cjs
 */
const fs = require('fs');
const path = require('path');

// deploy/deploy/aapanel → monorepo root (three levels up)
const ROOT = path.resolve(__dirname, '../../..');

function loadDotEnv(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) return env;

  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
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
    if (key) env[key] = value;
  }
  return env;
}

const rootEnv = loadDotEnv(path.join(ROOT, '.env'));

module.exports = {
  apps: [
    {
      name: 'uniqbd-api',
      cwd: path.join(ROOT, 'apps/api'),
      script: 'dist/main.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        ...rootEnv,
      },
      max_memory_restart: '512M',
      error_file: '/www/wwwlogs/uniqbd-api-error.log',
      out_file: '/www/wwwlogs/uniqbd-api-out.log',
    },
    {
      name: 'uniqbd-web',
      cwd: path.join(ROOT, 'apps/web'),
      script: 'node_modules/next/dist/bin/next',
      args: 'start --port 3000 --hostname 127.0.0.1',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '768M',
      error_file: '/www/wwwlogs/uniqbd-web-error.log',
      out_file: '/www/wwwlogs/uniqbd-web-out.log',
    },
  ],
};
