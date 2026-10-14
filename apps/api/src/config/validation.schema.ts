import * as Joi from 'joi';

const weakSecretValues = [
  'change-me',
  'change-me-access',
  'change-me-refresh',
  'secret',
  'password',
  'REPLACE_WITH_RANDOM_SECRET_MIN_32_CHARS',
  'REPLACE_WITH_ANOTHER_RANDOM_SECRET',
];

const productionSecret = Joi.string()
  .min(32)
  .invalid(...weakSecretValues);

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .required(),
  API_HOST: Joi.string().ip({ version: ['ipv4', 'ipv6'] }).optional(),
  API_PORT: Joi.number().default(4000),
  API_GLOBAL_PREFIX: Joi.string().default('api'),
  API_CORS_ORIGIN: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string()
      .custom((value: string, helpers) => {
        try {
          const entries = value
            .split(',')
            .map((entry) => entry.trim())
            .filter(Boolean);
          if (
            entries.length === 0 ||
            entries.some((entry) => new URL(entry).protocol !== 'https:')
          ) {
            return helpers.error('any.invalid');
          }
          return value;
        } catch {
          return helpers.error('any.invalid');
        }
      })
      .required(),
    otherwise: Joi.string().default('http://localhost:3000'),
  }),

  MONGODB_URI: Joi.string().required(),

  JWT_ACCESS_SECRET: Joi.when('NODE_ENV', {
    is: 'production',
    then: productionSecret.required(),
    otherwise: Joi.string().min(8).required(),
  }),
  JWT_ACCESS_TTL: Joi.number()
    .integer()
    .min(300)
    .max(10 * 365 * 24 * 60 * 60)
    .default(10 * 365 * 24 * 60 * 60),
  JWT_REFRESH_SECRET: Joi.when('NODE_ENV', {
    is: 'production',
    then: productionSecret.required(),
    otherwise: Joi.string().min(8).required(),
  }),
  JWT_REFRESH_TTL: Joi.number()
    .integer()
    .min(300)
    .max(10 * 365 * 24 * 60 * 60)
    .default(10 * 365 * 24 * 60 * 60),
  JWT_GUEST_REFRESH_TTL: Joi.number()
    .integer()
    .min(300)
    .max(24 * 60 * 60)
    .optional(),
  MFS_APP_ACCESS_TTL_SECONDS: Joi.number()
    .integer()
    .min(300)
    .max(10 * 365 * 24 * 60 * 60)
    .optional(),
  MFS_APP_REFRESH_TTL_SECONDS: Joi.number()
    .integer()
    .min(300)
    .max(10 * 365 * 24 * 60 * 60)
    .optional(),
  MFS_SMS_SYNC_TOKEN: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string()
      .min(16)
      .invalid('REPLACE_WITH_RANDOM_MFS_SMS_SYNC_TOKEN')
      .required(),
    otherwise: Joi.string().allow('').optional(),
  }),

  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').optional(),
  DATA_ENCRYPTION_KEY: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string()
      .base64({ paddingRequired: true })
      .length(44)
      .invalid('REPLACE_WITH_32_BYTE_BASE64_KEY')
      .required(),
    otherwise: Joi.string().allow('').optional(),
  }),

  // --- Security / edge ---
  RECAPTCHA_SECRET: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().min(16).required(),
    otherwise: Joi.string().allow('').optional(),
  }),
  RECAPTCHA_SITE_KEY: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().min(10).required(),
    otherwise: Joi.string().allow('').optional(),
  }),
  RECAPTCHA_MIN_SCORE: Joi.number().min(0).max(1).optional(),
  THROTTLE_TTL_MS: Joi.number().optional(),
  THROTTLE_LIMIT: Joi.number().optional(),
  THROTTLE_BLOCK_MS: Joi.number().optional(),
  THROTTLE_AUTH_TTL_MS: Joi.number().optional(),
  THROTTLE_AUTH_LIMIT: Joi.number().optional(),
  TRUST_PROXY_HOPS: Joi.number().integer().min(0).max(2).default(1),
  LICENSE_SITE_SECRET: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().min(16).required(),
    otherwise: Joi.string().allow('').optional(),
  }),
  LICENSE_API_URL: Joi.string().uri().allow('').optional(),
  LICENSE_PRODUCT_ID: Joi.string().allow('').optional(),
  LICENSE_WEBSITE_ID: Joi.string().allow('').optional(),
  REDIS_OPTIONAL: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().valid('false').optional(),
    otherwise: Joi.string().valid('true', 'false').optional(),
  }),
  ALLOW_SANDBOX_INTEGRATIONS: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().valid('false').optional(),
    otherwise: Joi.string().valid('true', 'false').optional(),
  }),
  ALLOW_LEGACY_PLAINTEXT_SECRETS: Joi.string()
    .valid('true', 'false')
    .optional(),
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
  TMDB_API_KEY: Joi.string().allow('').optional(),
}).custom((env: Record<string, unknown>, helpers) => {
  if (
    env.NODE_ENV === 'production' &&
    env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET
  ) {
    return helpers.error('any.invalid', {
      message: 'JWT access and refresh secrets must be different',
    });
  }
  return env;
});
