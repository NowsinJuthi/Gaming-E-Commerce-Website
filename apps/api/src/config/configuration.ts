import { appConfig } from './namespaces/app.config';
import { databaseConfig } from './namespaces/database.config';
import { jwtConfig } from './namespaces/jwt.config';
import { paymentsConfig } from './namespaces/payments.config';
import { redisConfig } from './namespaces/redis.config';
import { suppliersConfig } from './namespaces/suppliers.config';
import { notificationsConfig } from './namespaces/notifications.config';
import { securityConfig } from './namespaces/security.config';
import { mailConfig } from './namespaces/mail.config';

export const configurations = [
  appConfig,
  databaseConfig,
  jwtConfig,
  redisConfig,
  paymentsConfig,
  suppliersConfig,
  notificationsConfig,
  securityConfig,
  mailConfig,
];
