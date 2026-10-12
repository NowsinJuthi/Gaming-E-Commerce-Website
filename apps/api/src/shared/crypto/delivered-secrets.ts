import { decryptSecretAtRest, encryptSecretAtRest, SECRET_AT_REST_PREFIX } from './secret-at-rest';

export type DeliveredSecretFields = {
  code: string;
  serial?: string;
  pin?: string;
};

function sealField(value: string | undefined, key?: Buffer): string | undefined {
  if (value === undefined || value === '') return value;
  if (!key) return value;
  if (value.startsWith(SECRET_AT_REST_PREFIX)) return value;
  return encryptSecretAtRest(value, key);
}

function openField(value: string | undefined, key?: Buffer): string | undefined {
  if (value === undefined || value === '') return value;
  return decryptSecretAtRest(value, key);
}

export function sealDeliveredSecret(
  plain: DeliveredSecretFields,
  key?: Buffer,
): DeliveredSecretFields {
  return {
    code: sealField(plain.code, key) ?? '',
    ...(plain.serial !== undefined
      ? { serial: sealField(plain.serial, key) }
      : {}),
    ...(plain.pin !== undefined ? { pin: sealField(plain.pin, key) } : {}),
  };
}

export function openDeliveredSecret(
  stored: DeliveredSecretFields,
  key?: Buffer,
): DeliveredSecretFields {
  return {
    code: openField(stored.code, key) ?? '',
    ...(stored.serial !== undefined
      ? { serial: openField(stored.serial, key) }
      : {}),
    ...(stored.pin !== undefined ? { pin: openField(stored.pin, key) } : {}),
  };
}

export function redactDeliveredSecret(): DeliveredSecretFields {
  return { code: '••••' };
}
