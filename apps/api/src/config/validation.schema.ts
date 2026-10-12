import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  API_HOST: Joi.string().ip({ version: ['ipv4', 'ipv6'] }).optional(),
  API_PORT: Joi.number().default(4000),
  API_GLOBAL_PREFIX: Joi.string().default('api'),
  API_CORS_ORIGIN: Joi.string().default('http://localhost:3000'),

  MONGODB_URI: Joi.string().required(),

  JWT_ACCESS_SECRET: Joi.string().min(8).required(),
  JWT_ACCESS_TTL: Joi.number().default(900),
  JWT_REFRESH_SECRET: Joi.string().min(8).required(),
  JWT_REFRESH_TTL: Joi.number().default(315360000),
  JWT_GUEST_REFRESH_TTL: Joi.number().optional(),
  MFS_APP_ACCESS_TTL_SECONDS: Joi.number().optional(),
  MFS_APP_REFRESH_TTL_SECONDS: Joi.number().optional(),

  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').optional(),
  DATA_ENCRYPTION_KEY: Joi.string().allow('').optional(),

  // --- Security / edge ---
  RECAPTCHA_SECRET: Joi.string().allow('').optional(),
  RECAPTCHA_MIN_SCORE: Joi.number().min(0).max(1).optional(),
  THROTTLE_TTL_MS: Joi.number().optional(),
  THROTTLE_LIMIT: Joi.number().optional(),
  THROTTLE_BLOCK_MS: Joi.number().optional(),
  THROTTLE_AUTH_TTL_MS: Joi.number().optional(),
  THROTTLE_AUTH_LIMIT: Joi.number().optional(),
  TRUST_PROXY_HOPS: Joi.number().optional(),
  ACTIVITY_TRACKING: Joi.string().valid('true', 'false').optional(),
  ACTIVITY_RETENTION_DAYS: Joi.number().optional(),

  // --- SMTP / email ---
  SMTP_HOST: Joi.string().allow('').optional(),
  SMTP_PORT: Joi.number().optional(),
  SMTP_SECURE: Joi.string().valid('true', 'false').optional(),
  SMTP_USER: Joi.string().allow('').optional(),
  SMTP_PASS: Joi.string().allow('').optional(),
  SMTP_FROM_NAME: Joi.string().allow('').optional(),
  SMTP_FROM_EMAIL: Joi.string().allow('').optional(),
  ADMIN_ALERT_EMAIL: Joi.string().allow('').optional(),
  WEB_APP_URL: Joi.string().allow('').optional(),
});
